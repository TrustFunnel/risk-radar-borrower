package com.riskradar.afueni;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.Telephony;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * AfueniSms: hands money SMS to the Afueni web app (src/lib/money/native.ts).
 * Only messages that pass MoneySenders ever leave this class. The web app
 * reads each one into a transaction on the phone and keeps only the figures.
 * Also opens text shared to Afueni from the SMS app on the Money screen.
 */
@CapacitorPlugin(name = "AfueniSms", permissions = { @Permission(alias = "sms", strings = { Manifest.permission.RECEIVE_SMS, Manifest.permission.READ_SMS }) })
public class AfueniSmsPlugin extends Plugin {
    private static AfueniSmsPlugin live; // the plugin while the app is open
    private static final int INBOX_LIMIT = 3000;

    @Override
    public void load() {
        live = this;
        openShared(getActivity().getIntent());
    }

    @Override
    protected void handleOnDestroy() {
        if (live == this) live = null;
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        openShared(intent);
    }

    static void deliver(Context context, String sender, String body, Long ms) {
        JSObject msg = message(sender, body, ms == null ? System.currentTimeMillis() : ms);
        AfueniSmsPlugin p = live;
        if (p != null && p.hasListeners("sms")) p.notifyListeners("sms", msg);
        else SmsQueue.add(context, msg);
    }

    private static JSObject message(String sender, String body, long ms) {
        JSObject o = new JSObject();
        o.put("sender", sender);
        o.put("body", body);
        o.put("ms", ms);
        SimpleDateFormat iso = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        iso.setTimeZone(TimeZone.getTimeZone("UTC"));
        o.put("receivedAt", iso.format(new Date(ms)));
        return o;
    }

    private String smsPermission() {
        PermissionState s = getPermissionState("sms");
        if (s == PermissionState.GRANTED) return "granted";
        if (s == PermissionState.DENIED) return "denied";
        return "prompt";
    }

    @PluginMethod
    public void status(PluginCall call) {
        JSObject r = new JSObject();
        r.put("permission", smsPermission());
        r.put("enabled", SmsQueue.isEnabled(getContext()));
        call.resolve(r);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (getPermissionState("sms") == PermissionState.GRANTED) {
            JSObject r = new JSObject();
            r.put("permission", "granted");
            call.resolve(r);
            return;
        }
        requestPermissionForAlias("sms", call, "smsPermissionResult");
    }

    @PermissionCallback
    private void smsPermissionResult(PluginCall call) {
        JSObject r = new JSObject();
        r.put("permission", smsPermission());
        call.resolve(r);
    }

    @PluginMethod
    public void setEnabled(PluginCall call) {
        SmsQueue.setEnabled(getContext(), Boolean.TRUE.equals(call.getBoolean("enabled", false)));
        call.resolve();
    }

    @PluginMethod
    public void drain(PluginCall call) {
        JSONArray q = SmsQueue.drain(getContext());
        JSArray out = new JSArray();
        for (int i = 0; i < q.length(); i++) {
            JSONObject o = q.optJSONObject(i);
            if (o != null) out.put(o);
        }
        JSObject r = new JSObject();
        r.put("messages", out);
        call.resolve(r);
    }

    // First switch-on: money messages already in the inbox since sinceMs.
    @PluginMethod
    public void readInbox(PluginCall call) {
        if (getPermissionState("sms") != PermissionState.GRANTED) {
            call.reject("SMS access not allowed");
            return;
        }
        long since = call.getLong("sinceMs", System.currentTimeMillis() - 183L * 24 * 3600 * 1000);
        getBridge().execute(() -> {
            JSArray out = new JSArray();
            String[] cols = { Telephony.Sms.ADDRESS, Telephony.Sms.BODY, Telephony.Sms.DATE };
            try (Cursor c = getContext().getContentResolver().query(Telephony.Sms.Inbox.CONTENT_URI, cols,
                    Telephony.Sms.DATE + " >= ?", new String[] { String.valueOf(since) }, Telephony.Sms.DATE + " ASC")) {
                if (c != null) {
                    while (c.moveToNext() && out.length() < INBOX_LIMIT) {
                        String sender = c.getString(0);
                        String body = c.getString(1);
                        if (MoneySenders.isMoneyMessage(sender, body)) out.put(message(sender, body, c.getLong(2)));
                    }
                }
            } catch (Exception e) {
                call.reject("Couldn't read messages: " + e.getMessage());
                return;
            }
            JSObject r = new JSObject();
            r.put("messages", out);
            call.resolve(r);
        });
    }

    // Text shared from the SMS app opens the Money screen. It goes in the
    // URL fragment (#), which browsers never send to the server.
    private void openShared(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return;
        String text = intent.getStringExtra(Intent.EXTRA_TEXT);
        if (text == null || text.isEmpty()) return;
        intent.setAction(Intent.ACTION_MAIN); // handle once
        String base = getBridge().getServerUrl();
        if (base == null || base.isEmpty()) return;
        String url = base.replaceAll("/+$", "") + "/money#text=" + Uri.encode(text);
        getBridge().getWebView().post(() -> getBridge().getWebView().loadUrl(url));
    }
}
