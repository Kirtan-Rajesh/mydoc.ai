/// API data models (manual JSON mapping — no codegen step needed).
library;

class UserModel {
  final String id;
  final String? phone;
  final String? email;
  final String name;
  final String languagePref;

  UserModel({
    required this.id,
    this.phone,
    this.email,
    required this.name,
    required this.languagePref,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) => UserModel(
        id: json['id'] as String,
        phone: json['phone'] as String?,
        email: json['email'] as String?,
        name: (json['name'] as String?) ?? '',
        languagePref: (json['language_pref'] as String?) ?? 'en',
      );
}

class HealthProfile {
  final String? dateOfBirth;
  final String? gender;
  final String? bloodGroup;
  final double? heightCm;
  final double? weightKg;
  final List<String> conditions;
  final List<String> allergies;

  HealthProfile({
    this.dateOfBirth,
    this.gender,
    this.bloodGroup,
    this.heightCm,
    this.weightKg,
    this.conditions = const [],
    this.allergies = const [],
  });

  factory HealthProfile.fromJson(Map<String, dynamic> json) => HealthProfile(
        dateOfBirth: json['date_of_birth'] as String?,
        gender: json['gender'] as String?,
        bloodGroup: json['blood_group'] as String?,
        heightCm: (json['height_cm'] as num?)?.toDouble(),
        weightKg: (json['weight_kg'] as num?)?.toDouble(),
        conditions: List<String>.from((json['medical_conditions'] as List?) ?? []),
        allergies: List<String>.from((json['allergies'] as List?) ?? []),
      );
}

class DocumentModel {
  final String id;
  final String fileName;
  final String mimeType;
  final String status; // uploaded | processing | ready | failed
  final String? documentType;
  final String? reportDate;
  final String? labName;
  final String? summary;
  final Map<String, dynamic>? structuredData;
  final DateTime createdAt;

  DocumentModel({
    required this.id,
    required this.fileName,
    required this.mimeType,
    required this.status,
    this.documentType,
    this.reportDate,
    this.labName,
    this.summary,
    this.structuredData,
    required this.createdAt,
  });

  factory DocumentModel.fromJson(Map<String, dynamic> json) => DocumentModel(
        id: json['id'] as String,
        fileName: json['file_name'] as String,
        mimeType: json['mime_type'] as String,
        status: json['status'] as String,
        documentType: json['document_type'] as String?,
        reportDate: json['report_date'] as String?,
        labName: json['lab_name'] as String?,
        summary: json['summary'] as String?,
        structuredData: json['structured_data'] as Map<String, dynamic>?,
        createdAt: DateTime.parse(json['created_at'] as String),
      );

  bool get isProcessing => status == 'uploaded' || status == 'processing';
}

class Conversation {
  final String id;
  final String title;
  final DateTime updatedAt;

  Conversation({required this.id, required this.title, required this.updatedAt});

  factory Conversation.fromJson(Map<String, dynamic> json) => Conversation(
        id: json['id'] as String,
        title: json['title'] as String,
        updatedAt: DateTime.parse(json['updated_at'] as String),
      );
}

class ChatMessage {
  final String role; // user | assistant
  String content;
  final List<String> sources;
  bool streaming;

  ChatMessage({
    required this.role,
    required this.content,
    this.sources = const [],
    this.streaming = false,
  });

  factory ChatMessage.fromJson(Map<String, dynamic> json) => ChatMessage(
        role: json['role'] as String,
        content: json['content'] as String,
        sources: List<String>.from((json['sources'] as List?) ?? []),
      );
}

class Medication {
  final String id;
  final String name;
  final String dosage;
  final String instructions;
  final List<String> times;
  final bool isActive;

  Medication({
    required this.id,
    required this.name,
    required this.dosage,
    required this.instructions,
    required this.times,
    required this.isActive,
  });

  factory Medication.fromJson(Map<String, dynamic> json) => Medication(
        id: json['id'] as String,
        name: json['name'] as String,
        dosage: (json['dosage'] as String?) ?? '',
        instructions: (json['instructions'] as String?) ?? '',
        times: List<String>.from((json['times'] as List?) ?? []),
        isActive: (json['is_active'] as bool?) ?? true,
      );
}

class TodayDose {
  final String medicationId;
  final String medicationName;
  final String dosage;
  final String time; // HH:MM
  final DateTime scheduledFor;
  final String status; // pending | taken | skipped

  TodayDose({
    required this.medicationId,
    required this.medicationName,
    required this.dosage,
    required this.time,
    required this.scheduledFor,
    required this.status,
  });

  factory TodayDose.fromJson(Map<String, dynamic> json) => TodayDose(
        medicationId: json['medication_id'] as String,
        medicationName: json['medication_name'] as String,
        dosage: (json['dosage'] as String?) ?? '',
        time: json['time'] as String,
        scheduledFor: DateTime.parse(json['scheduled_for'] as String),
        status: json['status'] as String,
      );
}

class FamilyMember {
  final String id;
  final String name;
  final String relation;

  FamilyMember({required this.id, required this.name, required this.relation});

  factory FamilyMember.fromJson(Map<String, dynamic> json) => FamilyMember(
        id: json['id'] as String,
        name: json['name'] as String,
        relation: json['relation'] as String,
      );
}
