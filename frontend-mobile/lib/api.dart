/// API client: dio + bearer-token interceptor + typed calls, including
/// SSE streaming for chat.
library;

import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'config.dart';
import 'models.dart';

class ApiException implements Exception {
  final int? statusCode;
  final String message;

  ApiException(this.statusCode, this.message);

  @override
  String toString() => message;
}

class ChatEvent {
  final String type; // meta | token | done
  final String? content;
  final String? conversationId;
  final List<String> sources;

  ChatEvent({required this.type, this.content, this.conversationId, this.sources = const []});
}

class ApiClient {
  ApiClient._(this._dio, this._storage);

  static const _tokenKey = 'mydoc_access_token';
  final Dio _dio;
  final FlutterSecureStorage _storage;
  String? _token;

  static Future<ApiClient> create() async {
    const storage = FlutterSecureStorage();
    final dio = Dio(BaseOptions(
      baseUrl: '${AppConfig.apiBaseUrl}${AppConfig.apiV1}',
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 60),
    ));
    final client = ApiClient._(dio, storage);
    client._token = await storage.read(key: _tokenKey);
    dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) {
        if (client._token != null) {
          options.headers['Authorization'] = 'Bearer ${client._token}';
        }
        handler.next(options);
      },
    ));
    return client;
  }

  bool get isLoggedIn => _token != null;

  Future<void> _setToken(String? token) async {
    _token = token;
    if (token == null) {
      await _storage.delete(key: _tokenKey);
    } else {
      await _storage.write(key: _tokenKey, value: token);
    }
  }

  ApiException _wrap(Object error) {
    if (error is DioException) {
      final data = error.response?.data;
      String message = 'Network error. Check your connection.';
      if (data is Map && data['detail'] != null) {
        message = data['detail'].toString();
      } else if (error.response != null) {
        message = 'Request failed (${error.response!.statusCode})';
      }
      return ApiException(error.response?.statusCode, message);
    }
    return ApiException(null, error.toString());
  }

  // ---------- Auth ----------

  Future<String?> requestOtp(String phone) async {
    try {
      final resp = await _dio.post('/auth/request-otp', data: {'phone': phone});
      return resp.data['dev_otp'] as String?;
    } catch (e) {
      throw _wrap(e);
    }
  }

  Future<bool> verifyOtp(String phone, String otp, {String? name}) async {
    try {
      final resp = await _dio.post('/auth/verify-otp', data: {
        'phone': phone,
        'otp': otp,
        if (name != null && name.isNotEmpty) 'name': name,
      });
      await _setToken(resp.data['access_token'] as String);
      return (resp.data['is_new_user'] as bool?) ?? false;
    } catch (e) {
      throw _wrap(e);
    }
  }

  Future<void> logout() => _setToken(null);

  // ---------- Users / profile ----------

  Future<UserModel> getMe() async {
    try {
      final resp = await _dio.get('/users/me');
      return UserModel.fromJson(resp.data as Map<String, dynamic>);
    } catch (e) {
      final wrapped = _wrap(e);
      if (wrapped.statusCode == 401) await _setToken(null);
      throw wrapped;
    }
  }

  Future<UserModel> updateMe({String? name, String? languagePref}) async {
    try {
      final resp = await _dio.patch('/users/me', data: {
        if (name != null) 'name': name,
        if (languagePref != null) 'language_pref': languagePref,
      });
      return UserModel.fromJson(resp.data as Map<String, dynamic>);
    } catch (e) {
      throw _wrap(e);
    }
  }

  Future<HealthProfile> getProfile() async {
    try {
      final resp = await _dio.get('/users/me/profile');
      return HealthProfile.fromJson(resp.data as Map<String, dynamic>);
    } catch (e) {
      throw _wrap(e);
    }
  }

  Future<HealthProfile> updateProfile(Map<String, dynamic> fields) async {
    try {
      final resp = await _dio.put('/users/me/profile', data: fields);
      return HealthProfile.fromJson(resp.data as Map<String, dynamic>);
    } catch (e) {
      throw _wrap(e);
    }
  }

  Future<List<FamilyMember>> getFamily() async {
    try {
      final resp = await _dio.get('/users/me/family');
      return (resp.data as List)
          .map((j) => FamilyMember.fromJson(j as Map<String, dynamic>))
          .toList();
    } catch (e) {
      throw _wrap(e);
    }
  }

  // ---------- Documents ----------

  Future<List<DocumentModel>> getDocuments() async {
    try {
      final resp = await _dio.get('/documents');
      return (resp.data as List)
          .map((j) => DocumentModel.fromJson(j as Map<String, dynamic>))
          .toList();
    } catch (e) {
      throw _wrap(e);
    }
  }

  Future<DocumentModel> getDocument(String id) async {
    try {
      final resp = await _dio.get('/documents/$id');
      return DocumentModel.fromJson(resp.data as Map<String, dynamic>);
    } catch (e) {
      throw _wrap(e);
    }
  }

  /// Upload from a file path (mobile) or raw bytes (web).
  Future<DocumentModel> uploadDocument({
    String? filePath,
    List<int>? bytes,
    required String fileName,
    required String mimeType,
  }) async {
    try {
      final file = bytes != null
          ? MultipartFile.fromBytes(bytes,
              filename: fileName, contentType: DioMediaType.parse(mimeType))
          : await MultipartFile.fromFile(filePath!,
              filename: fileName, contentType: DioMediaType.parse(mimeType));
      final resp = await _dio.post('/documents', data: FormData.fromMap({'file': file}));
      return DocumentModel.fromJson(resp.data as Map<String, dynamic>);
    } catch (e) {
      throw _wrap(e);
    }
  }

  /// Poll until a document leaves the processing states (or timeout).
  Future<DocumentModel> waitUntilProcessed(String id,
      {Duration timeout = const Duration(seconds: 90)}) async {
    final deadline = DateTime.now().add(timeout);
    while (true) {
      final doc = await getDocument(id);
      if (!doc.isProcessing || DateTime.now().isAfter(deadline)) return doc;
      await Future<void>.delayed(const Duration(seconds: 2));
    }
  }

  Future<void> deleteDocument(String id) async {
    try {
      await _dio.delete('/documents/$id');
    } catch (e) {
      throw _wrap(e);
    }
  }

  // ---------- Chat ----------

  Future<List<Conversation>> getConversations() async {
    try {
      final resp = await _dio.get('/chat/conversations');
      return (resp.data as List)
          .map((j) => Conversation.fromJson(j as Map<String, dynamic>))
          .toList();
    } catch (e) {
      throw _wrap(e);
    }
  }

  Future<List<ChatMessage>> getMessages(String conversationId) async {
    try {
      final resp = await _dio.get('/chat/conversations/$conversationId/messages');
      return (resp.data as List)
          .map((j) => ChatMessage.fromJson(j as Map<String, dynamic>))
          .toList();
    } catch (e) {
      throw _wrap(e);
    }
  }

  /// Sends a message and yields SSE events as they stream in.
  /// [documentId] attaches a just-uploaded report for the AI to analyse.
  Stream<ChatEvent> sendMessage(String message,
      {String? conversationId, String? documentId}) async* {
    Response<ResponseBody> resp;
    try {
      resp = await _dio.post<ResponseBody>(
        '/chat',
        data: {
          'message': message,
          if (conversationId != null) 'conversation_id': conversationId,
          if (documentId != null) 'document_id': documentId,
        },
        options: Options(responseType: ResponseType.stream),
      );
    } catch (e) {
      throw _wrap(e);
    }

    final lines = resp.data!.stream
        .map((chunk) => chunk.toList())
        .transform(utf8.decoder)
        .transform(const LineSplitter());

    await for (final line in lines) {
      if (!line.startsWith('data: ')) continue;
      final Map<String, dynamic> event;
      try {
        event = jsonDecode(line.substring(6)) as Map<String, dynamic>;
      } catch (_) {
        continue;
      }
      yield ChatEvent(
        type: event['type'] as String,
        content: event['content'] as String?,
        conversationId: event['conversation_id'] as String?,
        sources: List<String>.from((event['sources'] as List?) ?? []),
      );
    }
  }

  // ---------- Medications ----------

  Future<List<Medication>> getMedications() async {
    try {
      final resp = await _dio.get('/medications');
      return (resp.data as List)
          .map((j) => Medication.fromJson(j as Map<String, dynamic>))
          .toList();
    } catch (e) {
      throw _wrap(e);
    }
  }

  Future<Medication> createMedication({
    required String name,
    required String dosage,
    required String instructions,
    required List<String> times,
  }) async {
    try {
      final resp = await _dio.post('/medications', data: {
        'name': name,
        'dosage': dosage,
        'instructions': instructions,
        'times': times,
      });
      return Medication.fromJson(resp.data as Map<String, dynamic>);
    } catch (e) {
      throw _wrap(e);
    }
  }

  Future<void> deleteMedication(String id) async {
    try {
      await _dio.delete('/medications/$id');
    } catch (e) {
      throw _wrap(e);
    }
  }

  Future<List<TodayDose>> getTodayDoses() async {
    try {
      final resp = await _dio.get('/medications/today');
      return (resp.data as List)
          .map((j) => TodayDose.fromJson(j as Map<String, dynamic>))
          .toList();
    } catch (e) {
      throw _wrap(e);
    }
  }

  Future<void> logDose(String medicationId, DateTime scheduledFor, String status) async {
    try {
      await _dio.post('/medications/$medicationId/logs', data: {
        'scheduled_for': scheduledFor.toUtc().toIso8601String(),
        'status': status,
      });
    } catch (e) {
      throw _wrap(e);
    }
  }
}
