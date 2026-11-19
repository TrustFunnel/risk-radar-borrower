package com.riskradar.afueni;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.provider.Telephony;
import android.telephony.SmsMessage;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Called by Android for every incoming SMS once the borrower has allowed SMS
 * access. Non-money messages are dropped here and never stored or passed on.
 * Money messages go straight to the open app, or wait in SmsQueue.
 */
public class SmsReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(intent.getAction())) return;
        if (!SmsQueue.isEnabled(context)) return;
        SmsMessage[] parts = Telephony.Sms.Intents.getMessagesFromIntent(intent);
        if (parts == null) return;
        // Long messages arrive in parts: join them per sender.
        Map<String, StringBuilder> bodies = new LinkedHashMap<>();
        Map<String, Long> times = new LinkedHashMap<>();
        for (SmsMessage p : parts) {
            if (p == null) continue;
            String from = p.getDisplayOriginatingAddress();
            if (from == null) continue;
            StringBuilder sb = bodies.get(from);
            if (sb == null) {
                sb = new StringBuilder();
                bodies.put(from, sb);
                times.put(from, p.getTimestampMillis());
            }
            sb.append(p.getDisplayMessageBody());
        }
        for (Map.Entry<String, StringBuilder> e : bodies.entrySet()) {
            String body = e.getValue().toString();
            if (!MoneySenders.isMoneyMessage(e.getKey(), body)) continue;
            AfueniSmsPlugin.deliver(context, e.getKey(), body, times.get(e.getKey()));
        }
    }
}
