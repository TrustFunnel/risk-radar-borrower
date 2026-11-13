// Every message Afueni sends on WhatsApp, in English and Kiswahili.
// The Kiswahili lines are drafts: a native speaker must check them before
// launch (pilot checklist item 7). Keep messages short and plain; since
// 1 October 2026 Meta charges for service replies after 1,000 a month per
// number, so each step is one message, not several.
import type { ConsentPurpose, DistressLevel, Lang } from "./types";

export const BRAND = "Afueni by Risk Radar";
export const COACH_HOURS = { en: "8am to 8pm, Monday to Saturday", sw: "saa mbili asubuhi hadi saa mbili usiku, Jumatatu hadi Jumamosi" };

type T = Record<Lang, string>;
const t = (en: string, sw: string): T => ({ en, sw });

export const copy = {
  welcome: (name?: string) =>
    `Hi${name ? ` ${name}` : ""} 👋 Welcome to *${BRAND}*, a helping hand towards debt freedom.\n` +
    `Habari${name ? ` ${name}` : ""} 👋 Karibu *${BRAND}*.\n\n` +
    "Which language would you like? / Ungependa lugha gani?",

  consentAsk: t(
    `We help people who are struggling with loans make one plan they can afford, and we can talk to their lenders for them. It's free for borrowers, and we never lend money.\n\n` +
      `To help you we need to keep what you tell us here. We keep it safely, never sell it, and never share it with a lender without asking you first. You can ask us to delete it any time by sending DELETE.\n\n` +
      `Reply PRIVACY for the details. Do you agree to us keeping your information?`,
    `Tunasaidia watu wenye mzigo wa mikopo kupata mpango mmoja wa kulipa wanaoweza kumudu, na tunaweza kuongea na wakopeshaji kwa niaba yao. Ni bure kwa wakopaji, na hatukopeshi pesa.\n\n` +
      `Ili tukusaidie, tunahitaji kuhifadhi unachotuambia hapa. Tunakihifadhi salama, hatukiuzi, na hatukimpi mkopeshaji bila kukuuliza kwanza. Unaweza kutuomba tukifute wakati wowote kwa kutuma FUTA.\n\n` +
      `Tuma PRIVACY kwa maelezo zaidi. Je, unakubali tuhifadhi taarifa zako?`,
  ),
  consentButtons: { yes: t("Yes, I agree", "Ndiyo, nakubali"), no: t("No thanks", "Hapana asante"), person: t("Talk to a person", "Ongea na mtu") },

  privacy: t(
    `*How ${BRAND} looks after your information*\n` +
      `• What we keep: this chat, your answers, and documents you choose to send.\n` +
      `• Why: to understand your loans and help you make a plan. Nothing else.\n` +
      `• Who sees it: only the Afueni team. A lender or other partner sees your details only after you say YES to that, one lender at a time.\n` +
      `• How long: chat text is deleted after 90 days. If you don't agree to us keeping your information, everything is deleted 30 days after your last message.\n` +
      `• Your rights (Kenya Data Protection Act 2019): see, correct or delete your data, and withdraw any permission. Send DELETE to erase everything, or STOP and a number to withdraw one permission.\n` +
      `• Complaints: tell us here, or contact the Office of the Data Protection Commissioner (odpc.go.ke).`,
    `*Jinsi ${BRAND} inavyolinda taarifa zako*\n` +
      `• Tunachohifadhi: mazungumzo haya, majibu yako, na hati unazochagua kutuma.\n` +
      `• Kwa nini: kuelewa mikopo yako na kukusaidia kupata mpango. Si kitu kingine.\n` +
      `• Nani anaziona: timu ya Afueni pekee. Mkopeshaji au mshirika mwingine anaziona tu baada ya wewe kusema NDIO, mkopeshaji mmoja mmoja.\n` +
      `• Muda gani: maandishi ya mazungumzo yanafutwa baada ya siku 90. Usipokubali tuhifadhi taarifa zako, kila kitu kinafutwa siku 30 baada ya ujumbe wako wa mwisho.\n` +
      `• Haki zako (Sheria ya Ulinzi wa Data 2019): kuona, kurekebisha au kufuta data yako, na kuondoa ruhusa yoyote. Tuma FUTA kufuta kila kitu, au ACHA na nambari kuondoa ruhusa moja.\n` +
      `• Malalamiko: tuambie hapa, au wasiliana na Ofisi ya Kamishna wa Ulinzi wa Data (odpc.go.ke).`,
  ),

  declined: t(
    `No problem. We won't keep your details, and this chat will be deleted within 30 days.\n\nThree things that help when loans get heavy:\n1. List every loan and its due date in one place.\n2. Talk to a lender *before* a payment is missed; most will agree a new date.\n3. Never take a new loan to pay an old one without checking the total cost.\n\nSend HI any time if you change your mind.`,
    `Sawa. Hatutahifadhi taarifa zako, na mazungumzo haya yatafutwa ndani ya siku 30.\n\nMambo matatu yanayosaidia mikopo ikiwa mizito:\n1. Andika kila mkopo na tarehe yake ya kulipa mahali pamoja.\n2. Ongea na mkopeshaji *kabla* hujakosa malipo; wengi watakubali tarehe mpya.\n3. Usichukue mkopo mpya kulipa wa zamani bila kuangalia gharama yote.\n\nTuma HI wakati wowote ukibadilisha nia.`,
  ),

  askName: t("Thank you 🙏 What name should we call you?", "Asante 🙏 Tukuite jina gani?"),
  welcomeBack: (name: string, loans: number): T => t(
    `Welcome back, ${name} 👋 This number is linked to your Afueni app account${loans ? `, where you have ${loans} loan${loans === 1 ? "" : "s"} saved` : ""}.`,
    `Karibu tena, ${name} 👋 Nambari hii imeunganishwa na akaunti yako ya programu ya Afueni${loans ? `, ambapo una mikopo ${loans} iliyohifadhiwa` : ""}.`,
  ),

  qIntro: (name: string): T => t(
    `Nice to meet you, ${name}. A few quick questions so we understand your situation. You can type MENU or PERSON at any time.`,
    `Nimefurahi kukujua, ${name}. Maswali machache mafupi ili tuelewe hali yako. Unaweza kuandika MENU au MTU wakati wowote.`,
  ),
  qLoans: t("How many loans or loan apps do you owe right now? Count Fuliza, apps, bank, SACCO and chama. Reply with a number.", "Una mikopo au programu za mikopo ngapi unazodaiwa sasa? Hesabu Fuliza, programu, benki, SACCO na chama. Jibu kwa nambari."),
  qBehind: t("Are you behind on any of them?", "Je, umechelewa kulipa yoyote kati yake?"),
  yesNo: { yes: t("Yes", "Ndiyo"), no: t("No", "Hapana") },
  qDays: t("How far behind is the worst one?", "Ule uliochelewa zaidi umechelewa kwa muda gani?"),
  days: { under30: t("Under 1 month", "Chini ya mwezi 1"), "30to90": t("1 to 3 months", "Miezi 1 hadi 3"), over90: t("Over 3 months", "Zaidi ya miezi 3") },
  qIncomeType: t("Where does most of your income come from?", "Mapato yako mengi yanatoka wapi?"),
  incomeTypeButton: t("Choose", "Chagua"),
  incomeTypes: {
    salary: t("Salary", "Mshahara"),
    business: t("My own business", "Biashara yangu"),
    casual: t("Casual or gig work", "Vibarua"),
    none: t("No income right now", "Sina mapato sasa"),
  },
  qIncome: t("Roughly how much comes in each month, in KES? A rough figure is fine, e.g. 25000 or 25k.", "Takriban unapata kiasi gani kila mwezi, kwa KES? Kadirio linatosha, mfano 25000 au 25k."),
  qRepay: t("And roughly how much do all your loan repayments add up to each month, in KES?", "Na malipo ya mikopo yako yote yanafika takriban kiasi gani kila mwezi, kwa KES?"),
  qPressure: t("Last one. Is any lender threatening you, or has a loan gone to court or an auctioneer?", "Swali la mwisho. Je, kuna mkopeshaji anayekutishia, au mkopo umefika mahakamani au kwa dalali?"),
  pressure: { threats: t("Calls or threats", "Simu au vitisho"), court: t("Court or auctioneer", "Mahakama au dalali"), none: t("Neither", "Hakuna") },

  notUnderstood: t("Sorry, I didn't get that.", "Samahani, sijaelewa."),
  hintNumber: t("Please reply with a number, e.g. 3.", "Tafadhali jibu kwa nambari, mfano 3."),
  hintAmount: t("Please reply with an amount in KES, e.g. 25000.", "Tafadhali jibu kwa kiasi cha KES, mfano 25000."),
  hintButtons: t("Please tap one of the options.", "Tafadhali gusa moja ya chaguo."),
  stuck: t("Let me get a person to help you. ", "Wacha nimlete mtu akusaidie. "),

  result: {
    stable: t(
      "Thank you. From what you told me, your loans look manageable right now 👍 Keep repayments under about a third of what comes in, and talk to a lender early if a payment will be late.",
      "Asante. Kulingana na ulichoniambia, mikopo yako inaonekana inamudu kwa sasa 👍 Weka malipo chini ya theluthi moja ya mapato yako, na ongea na mkopeshaji mapema kama malipo yatachelewa.",
    ),
    stretched: t(
      "Thank you. Your loans are taking a big share of what comes in, so things could get hard quickly. A plan now can stop that. The best next step is to send us your M-Pesa statement so we can work out a payment you can safely afford.",
      "Asante. Mikopo yako inachukua sehemu kubwa ya mapato yako, kwa hivyo mambo yanaweza kuwa magumu haraka. Mpango sasa unaweza kuzuia hilo. Hatua bora inayofuata ni kututumia taarifa yako ya M-Pesa ili tukokotoe malipo unayoweza kumudu kwa usalama.",
    ),
    distressed: t(
      "Thank you for telling me. This is a lot to carry, and you're not alone. We'd like one of our coaches to work through it with you and look at a single plan you can afford, which we can then take to your lenders.",
      "Asante kwa kuniambia. Huu ni mzigo mzito, na hauko peke yako. Tungependa mmoja wa makocha wetu apitie hili nawe na kuangalia mpango mmoja unaoweza kumudu, ambao tunaweza kupeleka kwa wakopeshaji wako.",
    ),
    crisis: t(
      "Thank you for telling me. This is serious, and we want to help quickly. I've asked a coach to contact you as a priority.",
      "Asante kwa kuniambia. Hili ni jambo zito, na tunataka kukusaidia haraka. Nimemwomba kocha akuwasiliane nawe kwa kipaumbele.",
    ),
  } satisfies Record<DistressLevel, T>,
  threatsNote: t(
    "Know your rights: licensed lenders and their collectors must not threaten you, shame you, or contact your family, friends or employer about your debt. Keep screenshots of any such messages.",
    "Jua haki zako: wakopeshaji wenye leseni na wakusanyaji wao hawaruhusiwi kukutishia, kukuaibisha, au kuwasiliana na familia, marafiki au mwajiri wako kuhusu deni lako. Hifadhi picha za skrini za jumbe kama hizo.",
  ),
  courtNote: t(
    "Because a court or auctioneer is involved, please don't ignore any papers you've received; deadlines matter. Our coach will help you find free legal help, e.g. Kituo Cha Sheria.",
    "Kwa sababu mahakama au dalali anahusika, tafadhali usipuuze karatasi zozote ulizopokea; tarehe za mwisho ni muhimu. Kocha wetu atakusaidia kupata msaada wa kisheria wa bure, mfano Kituo Cha Sheria.",
  ),
  caseOpened: t(
    `A coach will message you here within 2 hours (${COACH_HOURS.en}). You don't need to do anything now.`,
    `Kocha atakutumia ujumbe hapa ndani ya saa 2 (${COACH_HOURS.sw}). Huhitaji kufanya chochote sasa.`,
  ),
  caseAlreadyOpen: t("A coach already has your chat and will reply here soon.", "Kocha tayari ana mazungumzo yako na atajibu hapa hivi karibuni."),

  menuBody: t("What would you like to do? You can also type MENU any time.", "Ungependa kufanya nini? Unaweza pia kuandika MENU wakati wowote."),
  menuButton: t("Options", "Chaguo"),
  menu: {
    assess: t("Check my situation", "Angalia hali yangu"),
    statement: t("Send a statement", "Tuma taarifa"),
    app: t("Use the Afueni app", "Tumia programu"),
    person: t("Talk to a person", "Ongea na mtu"),
    permissions: t("My permissions", "Ruhusa zangu"),
    delete: t("Delete my data", "Futa data yangu"),
  },
  menuDesc: {
    assess: t("Answer the questions again", "Jibu maswali tena"),
    statement: t("M-Pesa or bank, for a plan", "M-Pesa au benki, kwa mpango"),
    app: t("Track loans and see a plan", "Fuatilia mikopo na uone mpango"),
    person: t("A coach replies within 2 hours", "Kocha anajibu ndani ya saa 2"),
    permissions: t("See or change what you allow", "Ona au badilisha ruhusa"),
    delete: t("Erase everything we hold", "Futa kila kitu tulicho nacho"),
  },

  statement: t(
    "To get your M-Pesa statement: dial *334#, choose My Account, then M-PESA Statement (or use the M-PESA app). It comes by email as a PDF, with the password sent by SMS. Forward the PDF here. Please *don't* send the password in this chat; a coach will call you for it.",
    "Kupata taarifa yako ya M-Pesa: piga *334#, chagua Akaunti Yangu, kisha Taarifa ya M-PESA (au tumia programu ya M-PESA). Inakuja kwa barua pepe kama PDF, na nenosiri linatumwa kwa SMS. Tuma PDF hapa. Tafadhali *usitume* nenosiri katika mazungumzo haya; kocha atakupigia simu kulipata.",
  ),
  appLink: (url: string): T => t(
    `The Afueni app keeps all your loans in one place, shows the true cost of each, and builds a payoff plan: ${url}\nSign in with this same phone number.`,
    `Programu ya Afueni inaweka mikopo yako yote mahali pamoja, inaonyesha gharama halisi ya kila mmoja, na inatengeneza mpango wa kulipa: ${url}\nIngia kwa nambari hii hii ya simu.`,
  ),

  permissionNames: {
    keep: t("Keep my information (needed to help you)", "Kuhifadhi taarifa zangu (inahitajika kukusaidia)"),
    ai_read: t("Read my documents, including with AI (Anthropic, USA)", "Kusoma hati zangu, pamoja na AI (Anthropic, Marekani)"),
    crb: t("Request my CRB reports", "Kuomba ripoti zangu za CRB"),
    lenders: t("Speak to my lenders for me", "Kuongea na wakopeshaji wangu kwa niaba yangu"),
    reminders: t("Send me payment reminders", "Kunitumia vikumbusho vya malipo"),
  } satisfies Record<ConsentPurpose, T>,
  permissionsHeader: t("Your permissions. Reply YES and the number to allow one, or STOP and the number to withdraw it (e.g. STOP 5).", "Ruhusa zako. Jibu NDIO na nambari kuruhusu, au ACHA na nambari kuiondoa (mfano ACHA 5)."),
  on: t("on", "imewashwa"),
  off: t("off", "imezimwa"),
  granted: (what: string): T => t(`Done ✅ You've allowed: ${what}.`, `Sawa ✅ Umeruhusu: ${what}.`),
  withdrawn: (what: string): T => t(`Done. You've withdrawn: ${what}. We've stopped using your information for this.`, `Sawa. Umeondoa: ${what}. Tumeacha kutumia taarifa zako kwa hili.`),
  keepWithdrawn: t(
    "Done. You've withdrawn permission to keep your information. We'll delete your details within 30 days unless you send YES 1 again. Send DELETE to erase everything now.",
    "Sawa. Umeondoa ruhusa ya kuhifadhi taarifa zako. Tutafuta taarifa zako ndani ya siku 30 usipotuma NDIO 1 tena. Tuma FUTA kufuta kila kitu sasa.",
  ),
  needsCoach: t("A coach will message you to finish this step (for lenders, you'll sign a short letter of authority for each one).", "Kocha atakutumia ujumbe kukamilisha hatua hii (kwa wakopeshaji, utasaini barua fupi ya idhini kwa kila mmoja)."),
  needKeepFirst: t("First we need your OK to keep your information. Reply YES 1.", "Kwanza tunahitaji ruhusa yako kuhifadhi taarifa zako. Jibu NDIO 1."),

  deleteConfirm: t(
    "This will permanently erase this chat, your answers, your permissions and any documents you sent us here. It can't be undone. Are you sure?",
    "Hii itafuta kabisa mazungumzo haya, majibu yako, ruhusa zako na hati zozote ulizotutumia hapa. Haiwezi kurudishwa. Una uhakika?",
  ),
  deleteButtons: { yes: t("Yes, delete", "Ndiyo, futa"), no: t("No, keep it", "Hapana, acha") },
  deleted: t("Done. We've erased everything we held from this chat. Thank you for trusting us. Send HI if you ever want to start again.", "Imekamilika. Tumefuta kila kitu tulichokuwa nacho kutoka kwa mazungumzo haya. Asante kwa kutuamini. Tuma HI ukitaka kuanza tena."),
  deleteCancelled: t("OK, nothing was deleted.", "Sawa, hakuna kilichofutwa."),

  optedOut: t("You won't get any more messages from us. Send START if you want to talk again.", "Hutapokea jumbe zaidi kutoka kwetu. Tuma ANZA ukitaka kuongea tena."),
  optedIn: t("Welcome back 👋", "Karibu tena 👋"),

  mediaNoConsent: t("Thanks. Before you send documents, we need your OK to keep them. Reply YES 1, or PRIVACY to read how we look after them.", "Asante. Kabla hujatuma hati, tunahitaji ruhusa yako kuzihifadhi. Jibu NDIO 1, au PRIVACY kusoma jinsi tunavyozilinda."),
  mediaReceived: t("Got it, thank you 📄 A coach will check it and get back to you here.", "Nimepokea, asante 📄 Kocha ataiangalia na kukujibu hapa."),
  voiceReceived: t("Thanks for the voice note 🎙️ A coach will listen and reply here.", "Asante kwa ujumbe wa sauti 🎙️ Kocha atasikiliza na kujibu hapa."),
  unsupported: t("Sorry, I can only read text, documents, photos and voice notes.", "Samahani, ninaweza kusoma maandishi, hati, picha na jumbe za sauti pekee."),

  safety: t(
    "I'm really sorry you're feeling this way. You matter more than any debt. Please talk to someone now: call the Kenya Red Cross free line 1199, or go to the nearest hospital. If you are in danger, call 999 or 112. A member of our team will also reach out to you.",
    "Pole sana kwa unavyojisikia. Wewe ni muhimu kuliko deni lolote. Tafadhali ongea na mtu sasa: piga simu ya bure ya Kenya Red Cross 1199, au nenda hospitali iliyo karibu. Ukiwa hatarini, piga 999 au 112. Mmoja wa timu yetu pia atakutafuta.",
  ),
  langSwitched: t("OK, I'll use English.", "Sawa, nitatumia Kiswahili."),
};

export const say = (s: T, lang: Lang) => s[lang];
