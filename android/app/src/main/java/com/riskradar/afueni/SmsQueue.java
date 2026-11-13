package com.riskradar.afueni;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Money SMS that arrived while Afueni was closed, kept in the app's private
 * storage until the app next opens and reads them (then they are deleted).
 * Capped at 500 messages and 30 days. Also holds the on/off switch.
 */
final class SmsQueue {
    private static final String PREFS = "afueni_sms";
    private static final String KEY = "queue";
    private static final String ENABLED = "enabled";
    private static final int MAX = 500;
    private static final long MAX_AGE_MS = 30L * 24 * 3600 * 1000;

    private SmsQueue() {}

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static boolean isEnabled(Context c) {
        return prefs(c).getBoolean(ENABLED, false);
    }

    static void setEnabled(Context c, boolean on) {
        SharedPreferences.Editor e = prefs(c).edit().putBoolean(ENABLED, on);
        if (!on) e.remove(KEY); // switching off forgets anything waiting
        e.apply();
    }

    static synchronized void add(Context c, JSONObject msg) {
        JSONArray q = read(c);
        JSONArray kept = new JSONArray();
        long cutoff = System.currentTimeMillis() - MAX_AGE_MS;
        int start = Math.max(0, q.length() - (MAX - 1));
        for (int i = start; i < q.length(); i++) {
            JSONObject o = q.optJSONObject(i);
            if (o != null && o.optLong("ms", 0) >= cutoff) kept.put(o);
        }
        kept.put(msg);
        prefs(c).edit().putString(KEY, kept.toString()).apply();
    }

    static synchronized JSONArray drain(Context c) {
        JSONArray q = read(c);
        prefs(c).edit().remove(KEY).apply();
        return q;
    }

    private static JSONArray read(Context c) {
        try {
            return new JSONArray(prefs(c).getString(KEY, "[]"));
        } catch (JSONException e) {
            return new JSONArray();
        }
    }
}
