/// Riverpod providers: API client, auth state, and per-domain data.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api.dart';
import 'models.dart';

/// Initialized once in main() before runApp.
final apiClientProvider = Provider<ApiClient>((ref) {
  throw UnimplementedError('apiClientProvider must be overridden in main()');
});

class AuthState {
  final bool loggedIn;
  final UserModel? user;

  const AuthState({required this.loggedIn, this.user});
}

class AuthController extends Notifier<AuthState> {
  @override
  AuthState build() {
    final api = ref.read(apiClientProvider);
    if (api.isLoggedIn) {
      _loadUser();
      return const AuthState(loggedIn: true);
    }
    return const AuthState(loggedIn: false);
  }

  Future<void> _loadUser() async {
    try {
      final user = await ref.read(apiClientProvider).getMe();
      state = AuthState(loggedIn: true, user: user);
    } on ApiException catch (e) {
      if (e.statusCode == 401) {
        state = const AuthState(loggedIn: false);
      }
    }
  }

  Future<void> onVerified() async {
    state = const AuthState(loggedIn: true);
    await _loadUser();
  }

  Future<void> logout() async {
    await ref.read(apiClientProvider).logout();
    state = const AuthState(loggedIn: false);
  }

  Future<void> refreshUser() => _loadUser();
}

final authProvider = NotifierProvider<AuthController, AuthState>(AuthController.new);

final documentsProvider = FutureProvider.autoDispose<List<DocumentModel>>(
  (ref) => ref.watch(apiClientProvider).getDocuments(),
);

final conversationsProvider = FutureProvider.autoDispose<List<Conversation>>(
  (ref) => ref.watch(apiClientProvider).getConversations(),
);

final medicationsProvider = FutureProvider.autoDispose<List<Medication>>(
  (ref) => ref.watch(apiClientProvider).getMedications(),
);

final profileProvider = FutureProvider.autoDispose<HealthProfile>(
  (ref) => ref.watch(apiClientProvider).getProfile(),
);
