/* Hebrew interface dictionary with RTL handling.
   Exposed as a global `I18N` (no build step / modules to keep paths simple). */
(function () {
  'use strict';

  var dictionaries = {
    he: {
      app: { title: 'הום סטוק', tagline: 'ניהול מלאי חכם לבית', versionLabel: 'גרסה' },
      summary: {
        empty: 'עדיין לא הוספת פריטים',
        items_one: 'פריט אחד',
        items_other: '{{count}} פריטים',
        locations_one: 'מיקום אחד',
        locations_other: '{{count}} מיקומים',
        across: '{{items}} ב-{{locations}}',
      },
      locations: { Fridge: 'מקרר', Freezer: 'מקפיא', Pantry: 'מזווה', Toilet: 'שירותים', Shower: 'מקלחת', House: 'בית' },
      categories: {
        produce: 'ירקות',
        fruit: 'פירות',
        dairy: 'מוצרי חלב וביצים',
        meat: 'בשר ודגים',
        bakery: 'מאפים',
        dry: 'שימורים ומוצרים יבשים',
        grains: 'דגנים וקטניות',
        frozen: 'קפואים',
        drinks: 'משקאות',
        snacks: 'חטיפים',
        condiments: 'תבלינים ורטבים',
        care: 'רחצה וטיפוח',
        paper: 'מוצרי נייר',
        household: 'ציוד לבית',
        other: 'אחר',
      },
      units: {
        pcs: 'יח׳',
        pack: 'חבילה',
        kg: 'ק״ג',
        g: 'גרם',
        L: 'ליטר',
        ml: 'מ״ל',
        box: 'קופסה',
        can: 'פחית',
      },
      card: { out: 'אזל' },
      fab: { add: 'הוספת פריט' },
      empty: {
        title: 'המזווה ריק',
        body: 'הקישו על כפתור ה־+ כדי להוסיף את הפריט הראשון ולהתחיל לעקוב אחר המזון שבבית.',
      },
      form: {
        addTitle: 'הוספת פריט',
        editTitle: 'עריכת פריט',
        name: 'שם',
        namePlaceholder: 'לדוגמה: חלב, ביצים, עגבניות',
        photo: 'תמונה',
        addPhoto: 'הוספת תמונה',
        changePhoto: 'החלפת תמונה',
        removePhoto: 'הסרת תמונה',
        imageError: 'לא ניתן לטעון את התמונה',
        location: 'מיקום',
        category: 'קטגוריה',
        quantity: 'כמות',
        unit: 'יחידה',
        desired: 'כמות רצויה (יעד חודשי)',
        note: 'הערה (רשות)',
        notePlaceholder: 'מותג, גודל, תזכורת…',
        delete: 'מחיקת פריט',
        cancel: 'ביטול',
        save: 'שמירת שינויים',
        create: 'הוספת מוצר',
      },
      deleteConfirm: {
        title: 'מחיקת פריט',
        message: 'להסיר את ״{{name}}״ מהמלאי?',
        cancel: 'ביטול',
        confirm: 'מחיקה',
      },
      autocomplete: {
        suggestions: 'הצעות',
        none: 'אין התאמות',
      },
      restock: {
        title: 'רשימת קניות',
        missing: 'חסר {{missing}} (יש {{have}} מתוך {{target}})',
      },
      shopping: {
        title: 'רשימת קניות',
        addItem: 'הוספת פריט',
        empty: 'רשימת הקניות ריקה',
        need: 'חסר {{missing}} {{unit}}',
        needQty: 'צריך {{qty}} {{unit}}',
        markRestocked: 'סימון כחודש',
        purchase: 'סימון כנקנה (הוספה למלאי)',
        purchased: 'נוסף למלאי',
        addToList: 'הוספה לרשימת הקניות',
        addedToList: 'נוסף לרשימת הקניות',
        suggestions: 'הצעות',
        suggestionsSub: 'המלאי שלכם אוזל',
        namePlaceholder: 'לדוגמה: חלב',
        nameLabel: 'פריט',
        quantity: 'כמות',
        editTitle: 'עריכת פריט קנייה',
        save: 'הוספה לרשימה',
        remove: 'הסרה מהרשימה',
        removed: 'הוסר מהרשימה',
        collapse: 'כיווץ הפאנל',
        expand: 'הרחבת הפאנל',
      },
      scan: {
        button: 'סריקת מוצר',
        fabHint: 'סריקה',
        point: 'כוונו את המצלמה אל ברקוד המוצר',
        looking: 'מחפש מוצר…',
        loading: 'טוען סורק…',
        loadError: 'טעינת הסורק נכשלה — השלימו את הפרטים',
        denied: 'הגישה למצלמה נדחתה. ניתן להוסיף את הפריט באופן ידני.',
        manual: 'הזנה ידנית',
        added: 'נוסף ״{{name}}״',
        notFound: 'המוצר לא נמצא — השלימו את הפרטים',
        undo: 'ביטול',
        continuous: 'סריקה רציפה',
        detected: 'זוהה {{code}}',
        found: 'המוצר נמצא',
        tipsTitle: 'לא מזהה? נסו כך',
        tipCloser: 'התקרבו מעט כך שהברקוד ימלא את המסגרת',
        tipLight: 'שפרו את התאורה והימנעו מבוהק',
        tipSteady: 'החזיקו את הטלפון יציב לרגע',
        tipRotate: 'סובבו את המוצר כך שהברקוד יהיה ישר',
        tipManual: 'או הקישו על ״הזנת ברקוד ידנית״',
        foundLocal: 'כבר קיים במזווה שלך',
        fromCatalog: 'מהמוצרים השמורים שלך',
        fromOff: 'יובא ממאגר המוצרים הפתוח',
        offline: 'לא מקוון — שימוש במוצרים השמורים בלבד',
        offUnreachable: 'לא ניתן להגיע למאגר המוצרים — השלימו את הפרטים',
        sessionTitle: 'נסרקו',
        sessionEmpty: 'סרקו ברקוד כדי להתחיל',
        addAll: 'הוספת הכול ({{count}})',
        committed: 'נוספו {{count}} מוצרים למזווה שלך',
        reviewTitle: 'בדיקת מוצר',
        newTitle: 'מוצר חדש',
        barcode: 'ברקוד',
        enName: 'שם באנגלית',
        heName: 'שם בעברית',
        brand: 'מותג',
        size: 'גודל אריזה',
        nameRequired: 'יש להזין שם אחד לפחות',
        addUnitsTitle: 'הוספה למלאי',
        inStock: 'במלאי: {{qty}} {{unit}}',
        howMany: 'כמה להוסיף?',
        add: 'הוספה',
        save: 'שמירה',
        unknownName: 'מוצר לא ידוע',
        manualBarcode: 'הזנת ברקוד ידנית',
        manualBarcodeTitle: 'הזנת ברקוד',
        manualBarcodeLabel: 'ברקוד',
        manualBarcodePlaceholder: 'לדוגמה: 7290000000001',
        manualBarcodeSubmit: 'חיפוש',
        debug: {
          title: 'ניפוי שגיאות סורק',
          camera: 'מצלמה',
          formats: 'פורמטים',
          fps: 'פריימים לשנייה',
          running: 'מפענח פעיל',
          frames: 'פריימים שעובדו',
          last: 'ברקוד אחרון',
          format: 'פורמט אחרון',
          error: 'שגיאה אחרונה',
          status: 'סטטוס',
          yes: 'כן',
          no: 'לא',
        },
      },
      monthly: {
        button: 'הוצאות חודשיות',
        title: 'הוצאות ומעקב חודשי',
        month: 'חודש',
        restocked: 'נרכש',
        consumed: 'נצרך',
        units: 'יח׳',
        needs: 'לרכישה החודש',
        none: 'אין מה לרכוש 🎉',
        empty: 'אין נתונים לחודש זה עדיין',
      },
      language: {
        title: 'שפה',
        a11y: 'שינוי שפה',
        english: 'אנגלית',
        hebrew: 'עברית',
      },
      a11y: {
        close: 'סגירה',
        increase: 'הוספה',
        decrease: 'הפחתה',
      },
      settings: {
        title: 'הגדרות',
        a11y: 'הגדרות',
        editProfile: 'עריכת פרופיל',
        account: 'חשבון',
        sync: 'סנכרון',
        syncSub: 'סנכרון בין מכשירים (רשות)',
      },
      sync: {
        title: 'סנכרון',
        a11y: 'מצב סנכרון',
        subtitle: 'המלאי ורשימת הקניות, מעודכנים בין המכשירים.',
        dormantNote:
          'הסנכרון כבוי. הום סטוק פועלת גם ללא חיבור לאינטרנט. חברו שרת סנכרון כדי לשתף את המלאי בין המכשירים.',
        setupGuide: 'עקבו אחר מדריך ההתקנה כדי ליצור שרת חינמי.',
        backendSettings: 'מתקדם: הגדרות שרת',
        backendSettingsSub:
          'עקיפה אופציונלית. האפליקציה כבר מגיעה מוגדרת — בדרך כלל אין צורך בזה.',
        scanToJoin: 'סרקו את הקוד ממכשיר אחר כדי להצטרף מיד.',
        linkedOk: 'המכשיר קושר — מסנכרן.',
        supabaseUrl: 'כתובת שרת הסנכרון',
        anonKey: 'מפתח גישה ציבורי',
        anonKeyHint: 'השתמשו במפתח הציבורי בלבד. אין להזין מפתח סודי או מפתח מנהל.',
        save: 'שמירה',
        saved: 'נשמר',
        enable: 'הפעלת סנכרון במכשיר הזה',
        enabling: 'מפעיל…',
        linkThisDevice: 'קישור המכשיר הזה',
        linkAnother: 'קישור מכשיר נוסף',
        linkCode: 'קוד הקישור של המכשיר הזה',
        linkUrl: 'קישור',
        enterCode: 'הזנת קוד קישור',
        codePlaceholder: 'הדביקו את הקוד מהמכשיר השני',
        link: 'קישור',
        copy: 'העתקה',
        copied: 'הועתק',
        syncNow: 'סנכרן עכשיו',
        regenerate: 'יצירת קוד חדש',
        regenerated: 'נוצר קוד חדש',
        disconnect: 'ניתוק המכשיר הזה',
        disconnectConfirm:
          'להפסיק לסנכרן במכשיר הזה? הנתונים המקומיים יישארו, רק הסנכרון ייפסק.',
        disconnected: 'נותק',
        resolveConflicts: 'פתרון התנגשויות',
        noConflicts: 'אין התנגשויות לפתרון.',
        lastSync: 'סנכרון אחרון',
        never: 'מעולם לא',
        status: {
          disabled: 'כבוי',
          idle: 'מסונכרן',
          syncing: 'מסנכרן…',
          offline: 'לא מקוון',
          conflict: 'התנגשות',
          error: 'שגיאת סנכרון',
        },
        conflictTitle: 'התנגשות בכמות',
        conflictBody:
          'הפריט הזה שונה בשני מכשירים. איזו כמות לשמור?',
        keepLocal: 'שמור מהמכשיר הזה',
        keepCloud: 'שמור מהענן',
        addTogether: 'חבר יחד',
        manual: 'הזנת ערך',
        apply: 'החלה',
        errUrl: 'הזינו תחילה כתובת שרת ומפתח ציבורי תקינים.',
        errLink: 'הקישור נכשל. בדקו את הקוד ואת החיבור.',
        errGeneric: 'משהו השתבש. נסו שוב.',
        linkUnavailable:
          'קישור מכשירים דורש עדכון חד־פעמי במסד הנתונים. יש להפעיל את קובץ הגדרת הסנכרון דרך לוח הניהול של השרת.',
        autoInfo:
          'אותו פרופיל מסתנכרן אוטומטית בין המכשירים שלכם, ללא צורך בסריקת קוד.',
        familyCode: 'קוד סנכרון משפחתי (אופציונלי)',
        familyCodePlaceholder: 'השאירו ריק כדי לסנכרן לפי שם בלבד',
        familyCodeHint:
          'לפרטיות: הגדירו את אותו קוד בכל מכשיר כדי לשתף את הפרופיל. ריק פירושו שכל מי שמשתמש באותו שם פרופיל מסתנכרן יחד.',
        familyCodeSave: 'שמירת קוד',
        familyCodeApplied: 'קוד הסנכרון הוחל — מסנכרן מחדש את המכשירים.',
        schemaOutdated:
          'סנכרון אוטומטי דורש עדכון חד־פעמי במסד הנתונים דרך לוח הניהול של השרת. בינתיים המלאי נשמר במכשיר הזה.',
        advancedLink: 'מתקדם: קישור באמצעות קוד במקום',
      },
      auth: {
        title: 'הום סטוק',
        subtitle: 'ניהול מלאי חכם לבית',
        a11y: 'פרופיל',
        chooseUser: 'בחרו פרופיל',
        chooseUserSub: 'הקישו על פרופיל כדי להמשיך',
        username: 'שם משתמש',
        usernameOptional: 'שם משתמש (אופציונלי)',
        usernamePlaceholder: 'לדוגמה: אלכס',
        addUser: 'הוספת משתמש',
        createUser: 'יצירת משתמש',
        createUserTitle: 'יצירת פרופיל',
        createButton: 'יצירה',
        editUser: 'עריכת משתמש',
        editUserTitle: 'עריכת פרופיל',
        switchUser: 'החלפת משתמש',
        switchUserSub: 'הקישו על פרופיל כדי להחליף מיד',
        manageUsers: 'ניהול משתמשים',
        manageUsersSub: 'הוספה, עריכה או מחיקה של פרופילים',
        back: 'חזרה',
        chooseAnother: 'בחירת משתמש אחר',
        deleteUser: 'מחיקת משתמש',
        activeUser: 'פעיל',
        displayName: 'שם תצוגה',
        displayNamePlaceholder: 'לדוגמה: אלכס',
        displayNameRequired: 'הזינו שם תצוגה',
        usernameTaken: 'שם המשתמש כבר תפוס',
        preferredLanguage: 'שפה מועדפת',
        profile: 'פרופיל',
        addAvatar: 'הוספת תמונה',
        changeAvatar: 'החלפת תמונה',
        removeAvatar: 'הסרת תמונה',
        save: 'שמירה',
        welcome: 'ברוכים הבאים, {{name}}',
        userCreated: 'המשתמש נוצר בהצלחה',
        userDeleted: 'המשתמש נמחק בהצלחה',
        confirmDeleteTitle: 'למחוק פרופיל זה?',
        confirmDeleteMsg:
          'פעולה זו תמחק לצמיתות את {{name}} ואת כל הנתונים שלו (מלאי, רשימות, תוכניות, מוצרים, תמונות). לא ניתן לשחזר.',
        cannotDeleteActive: 'עברו לפרופיל אחר תחילה כדי למחוק פרופיל זה.',
        loggedOut: 'התנתקת',
      },
    },
  };

  var RTL_LANGS = ['he'];
  var STORAGE_BASE = 'pantry.lang';
  var storageKey = STORAGE_BASE; // per-user key set via setUser()
  var lang = 'he';

  function isRtlLang(l) {
    return RTL_LANGS.indexOf(l) !== -1;
  }

  function lookup(l, path) {
    var parts = path.split('.');
    var cur = dictionaries[l];
    for (var i = 0; i < parts.length; i++) {
      if (cur && typeof cur === 'object' && parts[i] in cur) cur = cur[parts[i]];
      else return null;
    }
    return typeof cur === 'string' ? cur : null;
  }

  function t(path, vars) {
    var str = lookup(lang, path);
    if (str == null) return 'טקסט לא זמין';
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        str = str.replace(new RegExp('{{' + k + '}}', 'g'), String(vars[k]));
      });
    }
    return str;
  }

  // Pluralized count helper: base like "summary.items".
  function tc(base, count) {
    var key = base + (count === 1 ? '_one' : '_other');
    return t(key, { count: count });
  }

  function applyDir() {
    var rtl = isRtlLang(lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = rtl ? 'rtl' : 'ltr';
  }

  // HomeStock has one supported UI language, regardless of old preferences.
  function setLang() {
    lang = 'he';
    try { localStorage.setItem(storageKey, lang); } catch (e) {}
    applyDir();
  }

  function init() { setLang(); }

  function setUser(id) {
    storageKey = STORAGE_BASE + (id ? '.' + id : '');
    setLang();
  }

  window.I18N = {
    t: t,
    tc: tc,
    setLang: setLang,
    setUser: setUser,
    getLang: function () {
      return lang;
    },
    isRTL: function () {
      return isRtlLang(lang);
    },
    init: init,
    // Exposed for Hebrew completeness and language regression checks.
    _dicts: dictionaries,
  };
})();
