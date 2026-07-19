/**
 * UI locale for voice payment flow.
 * Locale is inferred from what the user spoke (script + pay verbs), then speech engine lang.
 */

export type UiLocale =
  | "en"
  | "hi"
  | "es"
  | "fr"
  | "de"
  | "pt"
  | "ar"
  | "ja"
  | "zh"
  | "ko"
  | "it"
  | "nl"
  | "tr"
  | "ru"
  | "bn"
  | "ta"
  | "te"
  | "mr"
  | "gu"
  | "kn"
  | "ml"
  | "pa";

export type PayCopy = {
  listening: string;
  listeningHint: string;
  verifyingPrivately: string;
  verifyingSub: string;
  checkingMerchant: string;
  checkingMerchantSub: string;
  confirmPayment: string;
  verifiedPayment: string;
  notVerifiedPayment: string;
  unverifiedWarn: string;
  unverifiedAck: string;
  eyebrow: string;
  amount: string;
  payTo: string;
  amountAria: string;
  recipientAria: string;
  recipientPlaceholder: string;
  decline: string;
  accept: string;
  sending: string;
  continueUnverified: string;
  accepting: string;
  acceptingSub: string;
  paymentSent: string;
  declined: string;
  verified: string;
  /** Optional — merged from English when missing */
  voiceLowConfidence?: string;
  confirmAgain?: string;
  secondaryConfirmHint?: string;
  paymentSentTitle?: string;
  paymentSentSub?: string;
  declinedTitle?: string;
  declinedSub?: string;
  errorTitle?: string;
  noteLabel?: string;
  notePlaceholder?: string;
};

const COPY: Record<UiLocale, PayCopy> = {
  "en": {
    "listening": "I’m listening",
    "listeningHint": "Try “pay 500 to Priya”, or “borrow 1000”…",
    "verifyingPrivately": "Checking this privately",
    "verifyingSub": "Recipient · balance · your rules — on device",
    "checkingMerchant": "Looking up merchant…",
    "checkingMerchantSub": "Verified brands · trusted destinations",
    "confirmPayment": "Review & send",
    "verifiedPayment": "Verified merchant",
    "notVerifiedPayment": "Not on the verified list",
    "unverifiedWarn": "This name is in our catalog, but isn’t a verified Circle merchant. Only continue if you trust them.",
    "unverifiedAck": "I trust this — continue",
    "eyebrow": "Glance once more, then send",
    "amount": "You’re sending",
    "payTo": "To",
    "amountAria": "Payment amount",
    "recipientAria": "Recipient name",
    "recipientPlaceholder": "Friend, contact, or brand",
    "decline": "Not now",
    "accept": "Send payment",
    "sending": "Almost there…",
    "continueUnverified": "Send anyway",
    "accepting": "Sending…",
    "acceptingSub": "Midnight SNARK · no SMS",
    "paymentSent": "You’re all set",
    "declined": "Cancelled",
    "verified": "Verified",
    "voiceLowConfidence": "That was a little unclear — please check the amount and name",
    "confirmAgain": "Yes, send it",
    "secondaryConfirmHint": "This is a larger payment — tap once more to confirm",
    "paymentSentTitle": "Payment on its way",
    "paymentSentSub": "Settled privately on Midnight. Only you and they see the details.",
    "declinedTitle": "No payment sent",
    "declinedSub": "Nothing left your wallet. Tap the Circle card whenever you’re ready.",
    "errorTitle": "Couldn’t finish that",
    "noteLabel": "Private note",
    "notePlaceholder": "Optional — encrypted for them only"
  },
  "hi": {
    "listening": "सुन रहे हैं",
    "listeningHint": "कोई भी भाषा बोलें — राशि और नाम…",
    "verifyingPrivately": "निजी रूप से जाँच हो रही है",
    "verifyingSub": "प्राप्तकर्ता · बैलेंस · नीति",
    "checkingMerchant": "व्यापारी जाँच…",
    "checkingMerchantSub": "ब्रांड रजिस्ट्री · सत्यापित भुगतान",
    "confirmPayment": "भुगतान की पुष्टि करें",
    "verifiedPayment": "सत्यापित भुगतान",
    "notVerifiedPayment": "सत्यापित भुगतान नहीं",
    "unverifiedWarn": "यह ब्रांड कैटलॉग में है, लेकिन Circle के सत्यापित व्यापारी रजिस्ट्री में पंजीकृत नहीं है। तभी आगे बढ़ें जब आप इस गंतव्य पर भरोसा करें।",
    "unverifiedAck": "मैं समझता/समझती हूँ — फिर भी जारी रखें",
    "eyebrow": "भुगतान अनुरोध · स्वीकार से पहले संपादित करें",
    "amount": "राशि",
    "payTo": "किसे भेजें",
    "amountAria": "भुगतान राशि",
    "recipientAria": "प्राप्तकर्ता का नाम",
    "recipientPlaceholder": "संपर्क या ब्रांड का नाम",
    "decline": "अस्वीकार",
    "accept": "स्वीकार",
    "sending": "भेजा जा रहा है…",
    "continueUnverified": "बिना सत्यापन जारी रखें",
    "accepting": "स्वीकार हो रहा है",
    "acceptingSub": "Circle · कोई OTP नहीं · Midnight प्रमाण",
    "paymentSent": "भुगतान भेजा गया",
    "declined": "अस्वीकृत",
    "verified": "सत्यापित"
  },
  "es": {
    "listening": "Escuchando",
    "listeningHint": "Habla en cualquier idioma — monto y nombre…",
    "verifyingPrivately": "Verificando en privado",
    "verifyingSub": "Destinatario · saldo · política",
    "checkingMerchant": "Comprobando comercio…",
    "checkingMerchantSub": "Registro de marcas · pago verificado",
    "confirmPayment": "Confirmar pago",
    "verifiedPayment": "Pago verificado",
    "notVerifiedPayment": "Pago no verificado",
    "unverifiedWarn": "Esta marca está en nuestro catálogo pero no está registrada en el registro de comercios verificados de Circle. Continúa solo si confías en este destino.",
    "unverifiedAck": "Entiendo — continuar de todos modos",
    "eyebrow": "Solicitud de pago · edita antes de aceptar",
    "amount": "Monto",
    "payTo": "Pagar a",
    "amountAria": "Monto del pago",
    "recipientAria": "Nombre del destinatario",
    "recipientPlaceholder": "Contacto o marca",
    "decline": "Rechazar",
    "accept": "Aceptar",
    "sending": "Enviando…",
    "continueUnverified": "Continuar sin verificar",
    "accepting": "Aceptando",
    "acceptingSub": "Circle · sin OTP · attest Midnight",
    "paymentSent": "Pago enviado",
    "declined": "Rechazado",
    "verified": "Verificado"
  },
  "fr": {
    "listening": "Écoute",
    "listeningHint": "Parlez dans n’importe quelle langue — montant et nom…",
    "verifyingPrivately": "Vérification privée",
    "verifyingSub": "Destinataire · solde · politique",
    "checkingMerchant": "Vérification du marchand…",
    "checkingMerchantSub": "Registre des marques · paiement vérifié",
    "confirmPayment": "Confirmer le paiement",
    "verifiedPayment": "Paiement vérifié",
    "notVerifiedPayment": "Paiement non vérifié",
    "unverifiedWarn": "Cette marque est dans notre catalogue mais n’est pas inscrite au registre des marchands vérifiés Circle. Continuez seulement si vous faites confiance à cette destination.",
    "unverifiedAck": "Je comprends — continuer quand même",
    "eyebrow": "Demande de paiement · modifier avant d’accepter",
    "amount": "Montant",
    "payTo": "Payer à",
    "amountAria": "Montant du paiement",
    "recipientAria": "Nom du destinataire",
    "recipientPlaceholder": "Contact ou marque",
    "decline": "Refuser",
    "accept": "Accepter",
    "sending": "Envoi…",
    "continueUnverified": "Continuer non vérifié",
    "accepting": "Acceptation",
    "acceptingSub": "Circle · sans OTP · attestation Midnight",
    "paymentSent": "Paiement envoyé",
    "declined": "Refusé",
    "verified": "Vérifié"
  },
  "de": {
    "listening": "Zuhören",
    "listeningHint": "Sprechen Sie in beliebiger Sprache — Betrag und Name…",
    "verifyingPrivately": "Privat prüfen",
    "verifyingSub": "Empfänger · Saldo · Richtlinie",
    "checkingMerchant": "Händler prüfen…",
    "checkingMerchantSub": "Markenregister · verifizierte Zahlung",
    "confirmPayment": "Zahlung bestätigen",
    "verifiedPayment": "Verifizierte Zahlung",
    "notVerifiedPayment": "Keine verifizierte Zahlung",
    "unverifiedWarn": "Diese Marke ist im Katalog, aber nicht im verifizierten Händlerregister von Circle. Fahren Sie nur fort, wenn Sie dem Ziel vertrauen.",
    "unverifiedAck": "Ich verstehe — trotzdem fortfahren",
    "eyebrow": "Zahlungsanfrage · vor Annahme bearbeiten",
    "amount": "Betrag",
    "payTo": "Zahlen an",
    "amountAria": "Zahlungsbetrag",
    "recipientAria": "Empfängername",
    "recipientPlaceholder": "Kontakt oder Marke",
    "decline": "Ablehnen",
    "accept": "Annehmen",
    "sending": "Senden…",
    "continueUnverified": "Unverifiziert fortfahren",
    "accepting": "Wird angenommen",
    "acceptingSub": "Circle · kein OTP · Midnight-Attest",
    "paymentSent": "Zahlung gesendet",
    "declined": "Abgelehnt",
    "verified": "Verifiziert"
  },
  "pt": {
    "listening": "Ouvindo",
    "listeningHint": "Fale em qualquer idioma — valor e nome…",
    "verifyingPrivately": "Verificando em privado",
    "verifyingSub": "Destinatário · saldo · política",
    "checkingMerchant": "Verificando comerciante…",
    "checkingMerchantSub": "Registro de marcas · pagamento verificado",
    "confirmPayment": "Confirmar pagamento",
    "verifiedPayment": "Pagamento verificado",
    "notVerifiedPayment": "Pagamento não verificado",
    "unverifiedWarn": "Esta marca está no catálogo, mas não está registrada no registro de comerciantes verificados da Circle. Continue só se confiar neste destino.",
    "unverifiedAck": "Entendi — continuar mesmo assim",
    "eyebrow": "Pedido de pagamento · edite antes de aceitar",
    "amount": "Valor",
    "payTo": "Pagar para",
    "amountAria": "Valor do pagamento",
    "recipientAria": "Nome do destinatário",
    "recipientPlaceholder": "Contato ou marca",
    "decline": "Recusar",
    "accept": "Aceitar",
    "sending": "Enviando…",
    "continueUnverified": "Continuar sem verificar",
    "accepting": "Aceitando",
    "acceptingSub": "Circle · sem OTP · atestado Midnight",
    "paymentSent": "Pagamento enviado",
    "declined": "Recusado",
    "verified": "Verificado"
  },
  "ar": {
    "listening": "جارٍ الاستماع",
    "listeningHint": "تحدث بأي لغة — المبلغ والاسم…",
    "verifyingPrivately": "التحقق بخصوصية",
    "verifyingSub": "المستلم · الرصيد · السياسة",
    "checkingMerchant": "التحقق من التاجر…",
    "checkingMerchantSub": "سجل العلامات · دفع موثّق",
    "confirmPayment": "تأكيد الدفع",
    "verifiedPayment": "دفع موثّق",
    "notVerifiedPayment": "دفع غير موثّق",
    "unverifiedWarn": "هذه العلامة موجودة في الكتالوج لكنها غير مسجّلة في سجل التجار الموثّقين لدى Circle. تابع فقط إذا وثقت بهذا الوجهة.",
    "unverifiedAck": "أفهم — المتابعة على أي حال",
    "eyebrow": "طلب دفع · عدّل قبل القبول",
    "amount": "المبلغ",
    "payTo": "الدفع إلى",
    "amountAria": "مبلغ الدفع",
    "recipientAria": "اسم المستلم",
    "recipientPlaceholder": "جهة اتصال أو علامة",
    "decline": "رفض",
    "accept": "قبول",
    "sending": "جارٍ الإرسال…",
    "continueUnverified": "المتابعة بدون توثيق",
    "accepting": "جارٍ القبول",
    "acceptingSub": "Circle · بدون OTP · إثبات Midnight",
    "paymentSent": "تم إرسال الدفع",
    "declined": "مرفوض",
    "verified": "موثّق"
  },
  "ja": {
    "listening": "聞いています",
    "listeningHint": "どの言語でも話せます — 金額と名前…",
    "verifyingPrivately": "非公開で確認中",
    "verifyingSub": "受取人 · 残高 · ポリシー",
    "checkingMerchant": "加盟店を確認中…",
    "checkingMerchantSub": "ブランド登録 · 確認済み支払い",
    "confirmPayment": "支払いを確認",
    "verifiedPayment": "確認済みの支払い",
    "notVerifiedPayment": "未確認の支払い",
    "unverifiedWarn": "このブランドはカタログにありますが、Circleの確認済み加盟店レジストリには登録されていません。信頼できる場合のみ続行してください。",
    "unverifiedAck": "理解しました — 続行する",
    "eyebrow": "支払いリクエスト · 承認前に編集",
    "amount": "金額",
    "payTo": "送金先",
    "amountAria": "支払い金額",
    "recipientAria": "受取人名",
    "recipientPlaceholder": "連絡先またはブランド名",
    "decline": "拒否",
    "accept": "承認",
    "sending": "送信中…",
    "continueUnverified": "未確認のまま続行",
    "accepting": "承認中",
    "acceptingSub": "Circle · OTPなし · Midnight証明",
    "paymentSent": "支払い完了",
    "declined": "拒否しました",
    "verified": "確認済み"
  },
  "zh": {
    "listening": "正在聆听",
    "listeningHint": "可用任意语言说出 — 金额和姓名…",
    "verifyingPrivately": "正在私密验证",
    "verifyingSub": "收款人 · 余额 · 策略",
    "checkingMerchant": "正在检查商户…",
    "checkingMerchantSub": "品牌登记 · 已验证付款",
    "confirmPayment": "确认付款",
    "verifiedPayment": "已验证付款",
    "notVerifiedPayment": "未验证付款",
    "unverifiedWarn": "该品牌在目录中，但未在 Circle 已验证商户登记处注册。仅在信任此收款方时继续。",
    "unverifiedAck": "我了解 — 仍要继续",
    "eyebrow": "付款请求 · 接受前可编辑",
    "amount": "金额",
    "payTo": "付款给",
    "amountAria": "付款金额",
    "recipientAria": "收款人姓名",
    "recipientPlaceholder": "联系人或品牌名",
    "decline": "拒绝",
    "accept": "接受",
    "sending": "发送中…",
    "continueUnverified": "未验证继续",
    "accepting": "正在接受",
    "acceptingSub": "Circle · 无 OTP · Midnight 证明",
    "paymentSent": "付款已发送",
    "declined": "已拒绝",
    "verified": "已验证"
  },
  "ko": {
    "listening": "듣는 중",
    "listeningHint": "어떤 언어로든 말하세요 — 금액과 이름…",
    "verifyingPrivately": "비공개 확인 중",
    "verifyingSub": "수취인 · 잔액 · 정책",
    "checkingMerchant": "가맹점 확인 중…",
    "checkingMerchantSub": "브랜드 등록 · 인증 결제",
    "confirmPayment": "결제 확인",
    "verifiedPayment": "인증된 결제",
    "notVerifiedPayment": "미인증 결제",
    "unverifiedWarn": "이 브랜드는 목록에 있지만 Circle 인증 가맹점 등록부에 없습니다. 신뢰할 때만 계속하세요.",
    "unverifiedAck": "이해했습니다 — 계속하기",
    "eyebrow": "결제 요청 · 수락 전 수정",
    "amount": "금액",
    "payTo": "받는 사람",
    "amountAria": "결제 금액",
    "recipientAria": "수취인 이름",
    "recipientPlaceholder": "연락처 또는 브랜드",
    "decline": "거절",
    "accept": "수락",
    "sending": "보내는 중…",
    "continueUnverified": "미인증으로 계속",
    "accepting": "수락 중",
    "acceptingSub": "Circle · OTP 없음 · Midnight 증명",
    "paymentSent": "결제 완료",
    "declined": "거절됨",
    "verified": "인증됨"
  },
  "it": {
    "listening": "In ascolto",
    "listeningHint": "Parla in qualsiasi lingua — importo e nome…",
    "verifyingPrivately": "Verifica privata",
    "verifyingSub": "Destinatario · saldo · policy",
    "checkingMerchant": "Controllo esercente…",
    "checkingMerchantSub": "Registro brand · pagamento verificato",
    "confirmPayment": "Conferma pagamento",
    "verifiedPayment": "Pagamento verificato",
    "notVerifiedPayment": "Pagamento non verificato",
    "unverifiedWarn": "Questo brand è nel catalogo ma non è registrato nel registro esercenti verificati Circle. Procedi solo se ti fidi di questa destinazione.",
    "unverifiedAck": "Ho capito — continua comunque",
    "eyebrow": "Richiesta di pagamento · modifica prima di accettare",
    "amount": "Importo",
    "payTo": "Paga a",
    "amountAria": "Importo del pagamento",
    "recipientAria": "Nome del destinatario",
    "recipientPlaceholder": "Contatto o brand",
    "decline": "Rifiuta",
    "accept": "Accetta",
    "sending": "Invio…",
    "continueUnverified": "Continua non verificato",
    "accepting": "Accettazione",
    "acceptingSub": "Circle · senza OTP · attest Midnight",
    "paymentSent": "Pagamento inviato",
    "declined": "Rifiutato",
    "verified": "Verificato"
  },
  "nl": {
    "listening": "Luisteren",
    "listeningHint": "Spreek in elke taal — bedrag en naam…",
    "verifyingPrivately": "Privé verifiëren",
    "verifyingSub": "Ontvanger · saldo · beleid",
    "checkingMerchant": "Handelaar controleren…",
    "checkingMerchantSub": "Merkregister · geverifieerde betaling",
    "confirmPayment": "Betaling bevestigen",
    "verifiedPayment": "Geverifieerde betaling",
    "notVerifiedPayment": "Niet-geverifieerde betaling",
    "unverifiedWarn": "Dit merk staat in onze catalogus maar is niet geregistreerd in het geverifieerde handelaarsregister van Circle. Ga alleen door als je dit vertrouwt.",
    "unverifiedAck": "Ik begrijp het — toch doorgaan",
    "eyebrow": "Betaalverzoek · bewerk vóór accepteren",
    "amount": "Bedrag",
    "payTo": "Betalen aan",
    "amountAria": "Betaalbedrag",
    "recipientAria": "Naam ontvanger",
    "recipientPlaceholder": "Contact of merk",
    "decline": "Weigeren",
    "accept": "Accepteren",
    "sending": "Verzenden…",
    "continueUnverified": "Doorgaan ongeverifieerd",
    "accepting": "Accepteren",
    "acceptingSub": "Circle · geen OTP · Midnight-attest",
    "paymentSent": "Betaling verzonden",
    "declined": "Geweigerd",
    "verified": "Geverifieerd"
  },
  "tr": {
    "listening": "Dinleniyor",
    "listeningHint": "Herhangi bir dilde konuşun — tutar ve isim…",
    "verifyingPrivately": "Gizli doğrulanıyor",
    "verifyingSub": "Alıcı · bakiye · politika",
    "checkingMerchant": "İşyeri kontrol ediliyor…",
    "checkingMerchantSub": "Marka kaydı · doğrulanmış ödeme",
    "confirmPayment": "Ödemeyi onayla",
    "verifiedPayment": "Doğrulanmış ödeme",
    "notVerifiedPayment": "Doğrulanmamış ödeme",
    "unverifiedWarn": "Bu marka katalogda var ancak Circle doğrulanmış işyeri kaydında değil. Yalnızca güvendiğinizde devam edin.",
    "unverifiedAck": "Anladım — yine de devam et",
    "eyebrow": "Ödeme isteği · kabulden önce düzenle",
    "amount": "Tutar",
    "payTo": "Öde",
    "amountAria": "Ödeme tutarı",
    "recipientAria": "Alıcı adı",
    "recipientPlaceholder": "Kişi veya marka",
    "decline": "Reddet",
    "accept": "Kabul et",
    "sending": "Gönderiliyor…",
    "continueUnverified": "Doğrulanmadan devam",
    "accepting": "Kabul ediliyor",
    "acceptingSub": "Circle · OTP yok · Midnight kanıt",
    "paymentSent": "Ödeme gönderildi",
    "declined": "Reddedildi",
    "verified": "Doğrulandı"
  },
  "ru": {
    "listening": "Слушаю",
    "listeningHint": "Говорите на любом языке — сумма и имя…",
    "verifyingPrivately": "Приватная проверка",
    "verifyingSub": "Получатель · баланс · политика",
    "checkingMerchant": "Проверка продавца…",
    "checkingMerchantSub": "Реестр брендов · проверенный платёж",
    "confirmPayment": "Подтвердить платёж",
    "verifiedPayment": "Проверенный платёж",
    "notVerifiedPayment": "Непроверенный платёж",
    "unverifiedWarn": "Этот бренд есть в каталоге, но не зарегистрирован в реестре проверенных продавцов Circle. Продолжайте только если доверяете получателю.",
    "unverifiedAck": "Понимаю — всё равно продолжить",
    "eyebrow": "Запрос на оплату · измените перед принятием",
    "amount": "Сумма",
    "payTo": "Кому",
    "amountAria": "Сумма платежа",
    "recipientAria": "Имя получателя",
    "recipientPlaceholder": "Контакт или бренд",
    "decline": "Отклонить",
    "accept": "Принять",
    "sending": "Отправка…",
    "continueUnverified": "Продолжить без проверки",
    "accepting": "Принятие",
    "acceptingSub": "Circle · без OTP · аттестация Midnight",
    "paymentSent": "Платёж отправлен",
    "declined": "Отклонено",
    "verified": "Проверено"
  },
  "bn": {
    "listening": "শুনছি",
    "listeningHint": "যেকোনো ভাষায় বলুন — পরিমাণ ও নাম…",
    "verifyingPrivately": "Verifying privately",
    "verifyingSub": "Recipient · balance · policy",
    "checkingMerchant": "Checking merchant…",
    "checkingMerchantSub": "Brand registry · verified payment",
    "confirmPayment": "পেমেন্ট নিশ্চিত করুন",
    "verifiedPayment": "যাচাইকৃত পেমেন্ট",
    "notVerifiedPayment": "যাচাইকৃত নয়",
    "unverifiedWarn": "This brand is in our catalog but is not registered with Circle’s verified-merchant registry. Proceed only if you trust this destination.",
    "unverifiedAck": "I understand — continue anyway",
    "eyebrow": "পেমেন্ট অনুরোধ · গ্রহণের আগে সম্পাদনা করুন",
    "amount": "পরিমাণ",
    "payTo": "প্রাপক",
    "amountAria": "Payment amount",
    "recipientAria": "Recipient name",
    "recipientPlaceholder": "Contact or brand name",
    "decline": "প্রত্যাখ্যান",
    "accept": "গ্রহণ",
    "sending": "পাঠানো হচ্ছে…",
    "continueUnverified": "Continue unverified",
    "accepting": "গ্রহণ হচ্ছে",
    "acceptingSub": "Circle · no OTP · Midnight attest",
    "paymentSent": "পেমেন্ট পাঠানো হয়েছে",
    "declined": "প্রত্যাখ্যাত",
    "verified": "Verified"
  },
  "ta": {
    "listening": "கேட்கிறது",
    "listeningHint": "எந்த மொழியிலும் பேசுங்கள் — தொகை மற்றும் பெயர்…",
    "verifyingPrivately": "Verifying privately",
    "verifyingSub": "Recipient · balance · policy",
    "checkingMerchant": "Checking merchant…",
    "checkingMerchantSub": "Brand registry · verified payment",
    "confirmPayment": "கட்டணத்தை உறுதிப்படுத்தவும்",
    "verifiedPayment": "சரிபார்க்கப்பட்ட கட்டணம்",
    "notVerifiedPayment": "சரிபார்க்கப்படாத கட்டணம்",
    "unverifiedWarn": "This brand is in our catalog but is not registered with Circle’s verified-merchant registry. Proceed only if you trust this destination.",
    "unverifiedAck": "I understand — continue anyway",
    "eyebrow": "கட்டண கோரிக்கை · ஏற்கும் முன் திருத்தவும்",
    "amount": "தொகை",
    "payTo": "யாருக்கு",
    "amountAria": "Payment amount",
    "recipientAria": "Recipient name",
    "recipientPlaceholder": "Contact or brand name",
    "decline": "நிராகரி",
    "accept": "ஏற்கவும்",
    "sending": "அனுப்புகிறது…",
    "continueUnverified": "Continue unverified",
    "accepting": "ஏற்கிறது",
    "acceptingSub": "Circle · no OTP · Midnight attest",
    "paymentSent": "கட்டணம் அனுப்பப்பட்டது",
    "declined": "நிராகரிக்கப்பட்டது",
    "verified": "Verified"
  },
  "te": {
    "listening": "వినిపిస్తోంది",
    "listeningHint": "Speak in any language — amount and name…",
    "verifyingPrivately": "Verifying privately",
    "verifyingSub": "Recipient · balance · policy",
    "checkingMerchant": "Checking merchant…",
    "checkingMerchantSub": "Brand registry · verified payment",
    "confirmPayment": "Confirm payment",
    "verifiedPayment": "Verified payment",
    "notVerifiedPayment": "Not a verified payment",
    "unverifiedWarn": "This brand is in our catalog but is not registered with Circle’s verified-merchant registry. Proceed only if you trust this destination.",
    "unverifiedAck": "I understand — continue anyway",
    "eyebrow": "చెల్లింపు అభ్యర్థన · అంగీకరించే ముందు సవరించండి",
    "amount": "మొత్తం",
    "payTo": "ఎవరికి",
    "amountAria": "Payment amount",
    "recipientAria": "Recipient name",
    "recipientPlaceholder": "Contact or brand name",
    "decline": "తిరస్కరించు",
    "accept": "అంగీకరించు",
    "sending": "పంపుతోంది…",
    "continueUnverified": "Continue unverified",
    "accepting": "అంగీకరిస్తోంది",
    "acceptingSub": "Circle · no OTP · Midnight attest",
    "paymentSent": "చెల్లింపు పంపబడింది",
    "declined": "తిరస్కరించబడింది",
    "verified": "Verified"
  },
  "mr": {
    "listening": "ऐकत आहे",
    "listeningHint": "Speak in any language — amount and name…",
    "verifyingPrivately": "Verifying privately",
    "verifyingSub": "Recipient · balance · policy",
    "checkingMerchant": "Checking merchant…",
    "checkingMerchantSub": "Brand registry · verified payment",
    "confirmPayment": "Confirm payment",
    "verifiedPayment": "Verified payment",
    "notVerifiedPayment": "Not a verified payment",
    "unverifiedWarn": "This brand is in our catalog but is not registered with Circle’s verified-merchant registry. Proceed only if you trust this destination.",
    "unverifiedAck": "I understand — continue anyway",
    "eyebrow": "पेमेंट विनंती · स्वीकारण्यापूर्वी संपादित करा",
    "amount": "रक्कम",
    "payTo": "कोणाला",
    "amountAria": "Payment amount",
    "recipientAria": "Recipient name",
    "recipientPlaceholder": "Contact or brand name",
    "decline": "नकार",
    "accept": "स्वीकार",
    "sending": "पाठवत आहे…",
    "continueUnverified": "Continue unverified",
    "accepting": "स्वीकारत आहे",
    "acceptingSub": "Circle · no OTP · Midnight attest",
    "paymentSent": "पेमेंट पाठवले",
    "declined": "नाकारले",
    "verified": "Verified"
  },
  "gu": {
    "listening": "સાંભળી રહ્યા છીએ",
    "listeningHint": "Speak in any language — amount and name…",
    "verifyingPrivately": "Verifying privately",
    "verifyingSub": "Recipient · balance · policy",
    "checkingMerchant": "Checking merchant…",
    "checkingMerchantSub": "Brand registry · verified payment",
    "confirmPayment": "Confirm payment",
    "verifiedPayment": "Verified payment",
    "notVerifiedPayment": "Not a verified payment",
    "unverifiedWarn": "This brand is in our catalog but is not registered with Circle’s verified-merchant registry. Proceed only if you trust this destination.",
    "unverifiedAck": "I understand — continue anyway",
    "eyebrow": "ચુકવણી વિનંતી · સ્વીકાર પહેલાં સંપાદિત કરો",
    "amount": "રકમ",
    "payTo": "કોને",
    "amountAria": "Payment amount",
    "recipientAria": "Recipient name",
    "recipientPlaceholder": "Contact or brand name",
    "decline": "નકારો",
    "accept": "સ્વીકારો",
    "sending": "મોકલી રહ્યા છીએ…",
    "continueUnverified": "Continue unverified",
    "accepting": "સ્વીકારી રહ્યા છીએ",
    "acceptingSub": "Circle · no OTP · Midnight attest",
    "paymentSent": "ચુકવણી મોકલાઈ",
    "declined": "નકારાયું",
    "verified": "Verified"
  },
  "kn": {
    "listening": "ಕೇಳುತ್ತಿದೆ",
    "listeningHint": "Speak in any language — amount and name…",
    "verifyingPrivately": "Verifying privately",
    "verifyingSub": "Recipient · balance · policy",
    "checkingMerchant": "Checking merchant…",
    "checkingMerchantSub": "Brand registry · verified payment",
    "confirmPayment": "Confirm payment",
    "verifiedPayment": "Verified payment",
    "notVerifiedPayment": "Not a verified payment",
    "unverifiedWarn": "This brand is in our catalog but is not registered with Circle’s verified-merchant registry. Proceed only if you trust this destination.",
    "unverifiedAck": "I understand — continue anyway",
    "eyebrow": "Payment request · edit before accept",
    "amount": "ಮೊತ್ತ",
    "payTo": "ಯಾರಿಗೆ",
    "amountAria": "Payment amount",
    "recipientAria": "Recipient name",
    "recipientPlaceholder": "Contact or brand name",
    "decline": "ನಿರಾಕರಿಸಿ",
    "accept": "ಸ್ವೀಕರಿಸಿ",
    "sending": "ಕಳುಹಿಸಲಾಗುತ್ತಿದೆ…",
    "continueUnverified": "Continue unverified",
    "accepting": "ಸ್ವೀಕರಿಸಲಾಗುತ್ತಿದೆ",
    "acceptingSub": "Circle · no OTP · Midnight attest",
    "paymentSent": "ಪಾವತಿ ಕಳುಹಿಸಲಾಗಿದೆ",
    "declined": "ನಿರಾಕರಿಸಲಾಗಿದೆ",
    "verified": "Verified"
  },
  "ml": {
    "listening": "കേൾക്കുന്നു",
    "listeningHint": "Speak in any language — amount and name…",
    "verifyingPrivately": "Verifying privately",
    "verifyingSub": "Recipient · balance · policy",
    "checkingMerchant": "Checking merchant…",
    "checkingMerchantSub": "Brand registry · verified payment",
    "confirmPayment": "Confirm payment",
    "verifiedPayment": "Verified payment",
    "notVerifiedPayment": "Not a verified payment",
    "unverifiedWarn": "This brand is in our catalog but is not registered with Circle’s verified-merchant registry. Proceed only if you trust this destination.",
    "unverifiedAck": "I understand — continue anyway",
    "eyebrow": "Payment request · edit before accept",
    "amount": "തുക",
    "payTo": "ആർക്ക്",
    "amountAria": "Payment amount",
    "recipientAria": "Recipient name",
    "recipientPlaceholder": "Contact or brand name",
    "decline": "നിരസിക്കുക",
    "accept": "അംഗീകരിക്കുക",
    "sending": "അയയ്ക്കുന്നു…",
    "continueUnverified": "Continue unverified",
    "accepting": "അംഗീകരിക്കുന്നു",
    "acceptingSub": "Circle · no OTP · Midnight attest",
    "paymentSent": "പേയ്‌മെന്റ് അയച്ചു",
    "declined": "നിരസിച്ചു",
    "verified": "Verified"
  },
  "pa": {
    "listening": "ਸੁਣ ਰਹੇ ਹਾਂ",
    "listeningHint": "Speak in any language — amount and name…",
    "verifyingPrivately": "Verifying privately",
    "verifyingSub": "Recipient · balance · policy",
    "checkingMerchant": "Checking merchant…",
    "checkingMerchantSub": "Brand registry · verified payment",
    "confirmPayment": "Confirm payment",
    "verifiedPayment": "Verified payment",
    "notVerifiedPayment": "Not a verified payment",
    "unverifiedWarn": "This brand is in our catalog but is not registered with Circle’s verified-merchant registry. Proceed only if you trust this destination.",
    "unverifiedAck": "I understand — continue anyway",
    "eyebrow": "Payment request · edit before accept",
    "amount": "ਰਕਮ",
    "payTo": "ਕਿਸ ਨੂੰ",
    "amountAria": "Payment amount",
    "recipientAria": "Recipient name",
    "recipientPlaceholder": "Contact or brand name",
    "decline": "ਇਨਕਾਰ",
    "accept": "ਸਵੀਕਾਰ",
    "sending": "ਭੇਜ ਰਹੇ ਹਾਂ…",
    "continueUnverified": "Continue unverified",
    "accepting": "ਸਵੀਕਾਰ ਹੋ ਰਿਹਾ ਹੈ",
    "acceptingSub": "Circle · no OTP · Midnight attest",
    "paymentSent": "ਭੁਗਤਾਨ ਭੇਜਿਆ ਗਿਆ",
    "declined": "ਇਨਕਾਰ ਕੀਤਾ",
    "verified": "Verified"
  }
} as Record<UiLocale, PayCopy>;

const SPEECH_TO_UI: Record<string, UiLocale> = {
  en: "en",
  hi: "hi",
  es: "es",
  fr: "fr",
  de: "de",
  pt: "pt",
  ar: "ar",
  ja: "ja",
  zh: "zh",
  ko: "ko",
  it: "it",
  nl: "nl",
  tr: "tr",
  ru: "ru",
  bn: "bn",
  ta: "ta",
  te: "te",
  mr: "mr",
  gu: "gu",
  kn: "kn",
  ml: "ml",
  pa: "pa",
};

/** Map BCP-47 / speech engine tag → UI locale */
export function localeFromSpeechTag(tag: string | undefined | null): UiLocale {
  if (!tag) return "en";
  const base = tag.toLowerCase().split("-")[0] || "en";
  return SPEECH_TO_UI[base] ?? "en";
}

/** Speech engine tag for a UI locale (best-effort) */
export function speechTagForLocale(locale: UiLocale): string {
  const map: Record<UiLocale, string> = {
    en: "en-US",
    hi: "hi-IN",
    es: "es-ES",
    fr: "fr-FR",
    de: "de-DE",
    pt: "pt-BR",
    ar: "ar-SA",
    ja: "ja-JP",
    zh: "zh-CN",
    ko: "ko-KR",
    it: "it-IT",
    nl: "nl-NL",
    tr: "tr-TR",
    ru: "ru-RU",
    bn: "bn-IN",
    ta: "ta-IN",
    te: "te-IN",
    mr: "mr-IN",
    gu: "gu-IN",
    kn: "kn-IN",
    ml: "ml-IN",
    pa: "pa-IN",
  };
  return map[locale] || "en-US";
}

/**
 * Infer spoken language from transcript (script first, then pay-verb keywords).
 * Falls back to speech engine tag / device language.
 */
export function detectLocaleFromText(
  text: string,
  fallbackSpeechTag?: string
): UiLocale {
  const raw = (text || "").trim();
  const fallback = () =>
    localeFromSpeechTag(
      fallbackSpeechTag || (typeof navigator !== "undefined" ? navigator.language : "en")
    );
  if (!raw) return fallback();

  if (/[\u0900-\u097F]/.test(raw)) {
    if (/पाठव/.test(raw)) return "mr";
    return "hi";
  }
  if (/[\u0980-\u09FF]/.test(raw)) return "bn";
  if (/[\u0A00-\u0A7F]/.test(raw)) return "pa";
  if (/[\u0A80-\u0AFF]/.test(raw)) return "gu";
  if (/[\u0B80-\u0BFF]/.test(raw)) return "ta";
  if (/[\u0C00-\u0C7F]/.test(raw)) return "te";
  if (/[\u0C80-\u0CFF]/.test(raw)) return "kn";
  if (/[\u0D00-\u0D7F]/.test(raw)) return "ml";
  if (/[\u0600-\u06FF]/.test(raw)) return "ar";
  if (/[\u3040-\u30FF]/.test(raw)) return "ja";
  if (/[\uAC00-\uD7AF]/.test(raw)) return "ko";
  if (/[\u4E00-\u9FFF]/.test(raw)) return "zh";
  if (/[\u0400-\u04FF]/.test(raw)) return "ru";

  const lower = raw.toLowerCase();
  if (/\b(pagar|envía|envia)\b/.test(lower)) return "es";
  if (/\b(enviar)\b/.test(lower) && /\b(para)\b/.test(lower)) {
    const fb = localeFromSpeechTag(fallbackSpeechTag);
    return fb === "pt" ? "pt" : "es";
  }
  if (/\b(payer|envoyer)\b/.test(lower)) return "fr";
  if (/\b(bezahlen|schicken|überweisen)\b/.test(lower)) return "de";
  if (/\b(pagare|invia|manda)\b/.test(lower)) return "it";
  if (/\b(betaal|stuur)\b/.test(lower)) return "nl";
  if (/\b(öde|gönder)\b/.test(lower)) return "tr";
  if (/\b(pay|send|transfer)\b/.test(lower)) return "en";

  return fallback();
}

export function payCopy(locale: UiLocale): PayCopy {
  const en = COPY.en;
  const loc = COPY[locale] || en;
  return {
    ...en,
    ...loc,
    voiceLowConfidence: loc.voiceLowConfidence || en.voiceLowConfidence,
    confirmAgain: loc.confirmAgain || en.confirmAgain,
    secondaryConfirmHint: loc.secondaryConfirmHint || en.secondaryConfirmHint,
    paymentSentTitle: loc.paymentSentTitle || en.paymentSentTitle,
    paymentSentSub: loc.paymentSentSub || en.paymentSentSub,
    declinedTitle: loc.declinedTitle || en.declinedTitle,
    declinedSub: loc.declinedSub || en.declinedSub,
    errorTitle: loc.errorTitle || en.errorTitle,
    noteLabel: loc.noteLabel || en.noteLabel,
    notePlaceholder: loc.notePlaceholder || en.notePlaceholder,
  };
}

export function isRtlLocale(locale: UiLocale): boolean {
  return locale === "ar";
}

export function defaultUiLocale(): UiLocale {
  if (typeof navigator === "undefined") return "en";
  return localeFromSpeechTag(navigator.language);
}
