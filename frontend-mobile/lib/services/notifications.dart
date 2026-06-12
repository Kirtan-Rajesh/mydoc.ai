/// Daily medication reminders via local notifications.
/// No-op on web; on Android/iOS schedules one daily notification per
/// medication time slot.
library;

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_timezone/flutter_timezone.dart';
import 'package:timezone/data/latest.dart' as tzdata;
import 'package:timezone/timezone.dart' as tz;

import '../models.dart';

class ReminderService {
  ReminderService._();

  static final ReminderService instance = ReminderService._();
  final _plugin = FlutterLocalNotificationsPlugin();
  bool _ready = false;

  Future<void> init() async {
    if (kIsWeb || _ready) return;
    tzdata.initializeTimeZones();
    try {
      final name = await FlutterTimezone.getLocalTimezone();
      tz.setLocalLocation(tz.getLocation(name));
    } catch (_) {
      // Fall back to tz.local default; reminders may be offset.
    }
    await _plugin.initialize(
      const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        iOS: DarwinInitializationSettings(),
      ),
    );
    await _plugin
        .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
        ?.requestNotificationsPermission();
    await _plugin
        .resolvePlatformSpecificImplementation<IOSFlutterLocalNotificationsPlugin>()
        ?.requestPermissions(alert: true, badge: true, sound: true);
    _ready = true;
  }

  static const _details = NotificationDetails(
    android: AndroidNotificationDetails(
      'med_reminders',
      'Medication reminders',
      channelDescription: 'Daily reminders to take your medicines',
      importance: Importance.high,
      priority: Priority.high,
    ),
    iOS: DarwinNotificationDetails(),
  );

  /// Replace all scheduled reminders with the current active medication plan.
  Future<void> syncFromMedications(List<Medication> medications) async {
    if (kIsWeb) return;
    await init();
    await _plugin.cancelAll();
    var id = 1;
    for (final med in medications.where((m) => m.isActive)) {
      for (final slot in med.times) {
        final hh = int.tryParse(slot.substring(0, 2)) ?? 8;
        final mm = int.tryParse(slot.substring(3, 5)) ?? 0;
        final now = tz.TZDateTime.now(tz.local);
        var when = tz.TZDateTime(tz.local, now.year, now.month, now.day, hh, mm);
        if (when.isBefore(now)) {
          when = when.add(const Duration(days: 1));
        }
        await _plugin.zonedSchedule(
          id++,
          'Time for ${med.name}',
          med.dosage.isEmpty ? 'Mark it as taken in mydoc.ai' : '${med.dosage} — mark it as taken in mydoc.ai',
          when,
          _details,
          androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
          uiLocalNotificationDateInterpretation:
              UILocalNotificationDateInterpretation.absoluteTime,
          matchDateTimeComponents: DateTimeComponents.time, // repeat daily
        );
      }
    }
  }
}
