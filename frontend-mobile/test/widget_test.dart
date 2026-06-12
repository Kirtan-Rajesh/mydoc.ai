import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mydoc_mobile/theme.dart';

void main() {
  testWidgets('theme builds and renders a Material app shell', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: buildTheme(),
        home: const Scaffold(body: Text('mydoc.ai')),
      ),
    );
    expect(find.text('mydoc.ai'), findsOneWidget);
  });
}
