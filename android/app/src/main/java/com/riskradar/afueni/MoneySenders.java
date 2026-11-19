package com.riskradar.afueni;

import java.util.regex.Pattern;

/**
 * Decides, on the phone, whether an SMS is a money message Afueni may read.
 * Everything else (personal messages, OTPs, promotions) is ignored and never
 * reaches the app's web layer, as Google Play's SMS policy and the Kenya Data
 * Protection Act require.
 *
 * Two checks, both must pass:
 *  1. The sender is a business sender ID or short code, never a phone number.
 *  2. The text looks like a money transaction or loan notice: it has a KES
 *     amount and a money word.
 */
final class MoneySenders {
    private MoneySenders() {}

    // A personal sender: a phone number (+2547..., 07..., 01...).
    private static final Pattern PHONE = Pattern.compile("^\\+?\\d{9,15}$");

    // Senders we know. Kept broad on purpose; the money-text check below still applies.
    private static final Pattern KNOWN = Pattern.compile(
        "(?i)^(m-?pesa|mpesa|airtel ?money|airtelmoney|t-?kash|fuliza|m-?shwari|kcb.*|equity.*|co-?op.*|coopbank|ncba.*|absa.*|stanbic.*|stanchart|scb.*|i&m.*|imbank|dtb.*|family ?bank|familybank|sidian.*|kingdom.*|postbank|boa.*|"
        + "tala|branch|zenka|okash|o-?pesa|timiza|eazzy.*|zash|ipesa|haraka|mkopo.*|watu.*|mogo|platinum.*|letshego.*|faulu.*|kwft|musoni|smep|rafiki.*|maisha.*|hustler.*|.*sacco.*|unaitas|stima.*|mwalimu.*)$");

    private static final Pattern AMOUNT = Pattern.compile("(?i)(ksh|kes|kshs)\\.?\\s?[\\d,]+");
    private static final Pattern MONEY_WORD = Pattern.compile(
        "(?i)\\b(confirmed|received|sent|paid|credited|debited|withdraw\\w*|deposit\\w*|balance|loan|repay\\w*|due|overdue|fuliza|disbursed|instal+ment)\\b");
    private static final Pattern SECRET = Pattern.compile("(?i)\\b(otp|one[- ]time|verification code|password)\\b");

    static boolean isMoneySender(String sender) {
        if (sender == null) return false;
        String s = sender.trim();
        if (s.isEmpty() || PHONE.matcher(s.replace(" ", "")).matches()) return false;
        // Short codes (e.g. 40333) and alphanumeric sender IDs are businesses.
        return KNOWN.matcher(s).matches() || s.matches("\\d{3,6}") || s.matches("(?i)[a-z][a-z0-9 &.-]{1,15}");
    }

    static boolean isMoneyMessage(String sender, String body) {
        if (!isMoneySender(sender) || body == null) return false;
        if (body.length() < 20 || body.length() > 1200) return false;
        if (SECRET.matcher(body).find() && !body.contains("Confirmed")) return false;
        return AMOUNT.matcher(body).find() && MONEY_WORD.matcher(body).find();
    }
}
