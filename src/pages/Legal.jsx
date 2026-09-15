import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import './Legal.css';

const Section = ({ number, title, children }) => (
  <section className="legal-section">
    <h2>{number}. {title}</h2>
    {children}
  </section>
);

export default function Legal() {
  const navigate = useNavigate();
  const { colors } = useTheme();
  const { language } = useLanguage();

  if (language === 'mm') {
    return (
      <main className="legal-page" style={{ background: colors.background, color: colors.textPrimary }}>
        <header className="legal-header">
          <button type="button" className="legal-back" onClick={() => navigate(-1)} aria-label="နောက်သို့">
            <FontAwesomeIcon icon={faArrowLeft} />
          </button>
          <div><p className="legal-eyebrow">BarKyanLal</p><h1>စည်းမျဉ်းနှင့် ကိုယ်ရေးလုံခြုံမှု</h1></div>
        </header>
        <article className="legal-card" style={{ background: colors.cardBg, borderColor: colors.cardBorder }}>
          <h2 className="legal-document-title">အသုံးပြုမှု စည်းမျဉ်းများ</h2>
          <p className="legal-effective">အကျိုးသက်ရောက်သည့်ရက်စွဲ: ၂၀၂၆ ခုနှစ် စက်တင်ဘာ ၁၂ ရက်</p>
          <p>ဤစည်းမျဉ်းများသည် BarKyanLal အက်ပ်နှင့် ဝန်ဆောင်မှုများကို အသုံးပြုမှုကို ထိန်းချုပ်ပါသည်။ အက်ပ်ကို အသုံးပြုခြင်းဖြင့် ဤစည်းမျဉ်းများကို ဖတ်ရှုနားလည်ပြီး သဘောတူကြောင်း အတည်ပြုပါသည်။</p>
          <Section number="၁" title="အက်ပ်အသုံးပြုခြင်း"><p>BarKyanLal သည် အစားအစာများ စီမံရန်၊ သက်တမ်းကုန်ရက် စောင့်ကြည့်ရန်၊ သတိပေးချက်များ လက်ခံရန်နှင့် ဟင်းချက်နည်း အကြံပြုချက်များ ရယူရန် AI အသုံးပြုသည့် အက်ပ်ဖြစ်သည်။ ဥပဒေနှင့်မညီသော အသုံးပြုမှု၊ ကူးယူပြင်ဆင်မှု၊ အနှောင့်အယှက်ပေးမှု သို့မဟုတ် အက်ပ်ကို အလွဲသုံးစားပြုမှု မပြုရပါ။</p></Section>
          <Section number="၂" title="အစားအစာအချက်အလက်နှင့် သက်တမ်းကုန်ရက်"><p>အစားအစာသည် စားသုံးရန် ဘေးကင်းကြောင်း BarKyanLal က အာမမခံပါ။ သက်တမ်းကုန်ရက်၊ သိမ်းဆည်းမှုနှင့် အစားအစာအခြေအနေကို ကိုယ်တိုင် စစ်ဆေးရန် အသုံးပြုသူတွင် တာဝန်ရှိပါသည်။</p></Section>
          <Section number="၃" title="AI အကြံပြုချက်များ"><p>AI မှ ထုတ်ပေးသော အစားအစာနှင့် ဟင်းချက်နည်းအချက်အလက်များသည် မပြည့်စုံခြင်း သို့မဟုတ် မမှန်ကန်ခြင်း ဖြစ်နိုင်ပါသည်။ ပါဝင်ပစ္စည်း၊ ပမာဏ၊ ပြင်ဆင်နည်း၊ အစားအသောက်လိုအပ်ချက်နှင့် အာလတ်ဂျီများကို ကိုယ်တိုင် စစ်ဆေးပါ။</p></Section>
          <Section number="၄" title="အသုံးပြုသူပေးသော အချက်အလက်"><p>အစားအစာအမည်၊ ပမာဏ၊ သက်တမ်းကုန်ရက်၊ သိမ်းဆည်းရာနေရာနှင့် ဓာတ်ပုံများ ထည့်သွင်းရာတွင် အသုံးပြုသူက အချက်အလက်များ မှန်ကန်စေရန် တာဝန်ယူရပါသည်။</p></Section>
          <Section number="၅" title="အသိပေးချက်နှင့် သတိပေးချက်များ"><p>အသိပေးချက်များသည် အကူအညီအဖြစ်သာ ပေးခြင်းဖြစ်ပြီး အစားအစာကို သက်တမ်းမကုန်မီ အမြဲသိရှိမည် သို့မဟုတ် စားသုံးမည်ဟု အာမမခံပါ။</p></Section>
          <Section number="၆" title="အင်တာနက်ချိတ်ဆက်မှု"><p>အချို့သောလုပ်ဆောင်ချက်များအတွက် Wi-Fi သို့မဟုတ် မိုဘိုင်းအင်တာနက် လိုအပ်ပါသည်။ ကွန်ရက်အခက်အခဲ သို့မဟုတ် ဒေတာကုန်ကျမှုအတွက် BarKyanLal တွင် တာဝန်မရှိပါ။</p></Section>
          <Section number="၇" title="ဝန်ဆောင်မှုရရှိနိုင်မှု"><p>ဝန်ဆောင်မှုကို အမြဲတမ်း အနှောင့်အယှက်မရှိ၊ အမှားမရှိ သို့မဟုတ် စက်တိုင်းနှင့် ကိုက်ညီမည်ဟု အာမမခံပါ။ လုပ်ဆောင်ချက်များကို ပြင်ဆင်၊ ရပ်ဆိုင်း သို့မဟုတ် ပြောင်းလဲနိုင်ပါသည်။</p></Section>
          <Section number="၈" title="တတိယပါတီ ဝန်ဆောင်မှုများ"><p>BarKyanLal သည် Supabase၊ Firebase Cloud Messaging၊ OpenRouter နှင့် MyMemory Translation API ကဲ့သို့ ဝန်ဆောင်မှုများကို အသုံးပြုပါသည်။ ထိုဝန်ဆောင်မှုများ၏ ကိုယ်ပိုင်စည်းမျဉ်းနှင့် ကိုယ်ရေးလုံခြုံမှု မူဝါဒများလည်း သက်ရောက်နိုင်ပါသည်။</p></Section>
          <Section number="၉" title="တာဝန်ခံမှု ကန့်သတ်ချက်"><p>ဥပဒေအရ ခွင့်ပြုသည့်အတိုင်း BarKyanLal နှင့် ဖန်တီးသူများသည် အစားအစာ၊ AI အချက်အလက်၊ သတိပေးချက်၊ ဒေတာဆုံးရှုံးမှု၊ အင်တာနက် သို့မဟုတ် စက်အခက်အခဲကြောင့် ဖြစ်သော ဆုံးရှုံးမှုများအတွက် တာဝန်မရှိပါ။ အစားအစာသိမ်းဆည်းခြင်းနှင့် စားသုံးခြင်းဆိုင်ရာ ဆုံးဖြတ်ချက်များသည် အသုံးပြုသူ၏ တာဝန်ဖြစ်သည်။</p></Section>
          <Section number="၁၀" title="အသုံးပြုခွင့် ရပ်ဆိုင်းခြင်း"><p>အလွဲသုံးစားပြုမှု၊ ဥပဒေချိုးဖောက်မှု သို့မဟုတ် ဤစည်းမျဉ်းများကို ချိုးဖောက်မှုရှိပါက အသုံးပြုခွင့်ကို ရပ်ဆိုင်းနိုင်ပါသည်။</p></Section>
          <Section number="၁၁" title="စည်းမျဉ်းပြောင်းလဲမှု"><p>ဤစည်းမျဉ်းများကို အချိန်နှင့်အမျှ ပြင်ဆင်နိုင်ပါသည်။ ပြင်ဆင်ပြီးနောက် ဆက်လက်အသုံးပြုခြင်းသည် ပြင်ဆင်ထားသော စည်းမျဉ်းများကို သဘောတူခြင်းဖြစ်ပါသည်။</p></Section>
          <Section number="၁၂" title="ဆက်သွယ်ရန်"><p>မေးမြန်းလိုသည်များကို အက်ပ်အတွင်း ဖော်ပြထားသော Team Blind Mice ၏ အကူအညီလမ်းကြောင်းမှ ပေးပို့နိုင်ပါသည်။</p></Section>
          <hr />
          <h2 className="legal-document-title">ကိုယ်ရေးလုံခြုံမှု မူဝါဒ</h2>
          <p className="legal-effective">အကျိုးသက်ရောက်သည့်ရက်စွဲ: ၂၀၂၆ ခုနှစ် စက်တင်ဘာ ၁၂ ရက်</p>
          <p>ဤမူဝါဒသည် BarKyanLal က အချက်အလက်များကို မည်သို့စုဆောင်း၊ အသုံးပြု၊ သိမ်းဆည်းနှင့် မျှဝေသည်ကို ရှင်းပြပါသည်။</p>
          <Section number="၁" title="စုဆောင်းသော အချက်အလက်များ"><p>အစားအစာအမည်၊ ပမာဏ၊ သက်တမ်းကုန်ရက်၊ သိမ်းဆည်းရာနေရာ၊ အမျိုးအစား၊ အကောင့်အချက်အလက်၊ ပရိုဖိုင်ဓာတ်ပုံနှင့် အကူအညီတောင်းခံစာများကို လုပ်ဆောင်နိုင်ပါသည်။</p></Section>
          <Section number="၂" title="အချက်အလက်အသုံးပြုမှု"><p>အက်ပ်လုပ်ဆောင်ချက်များ ပေးရန်၊ အစားအစာ စောင့်ကြည့်ရန်၊ သတိပေးရန်၊ AI အကြံပြုချက်များ ပေးရန်၊ အမှားရှာရန်နှင့် လုံခြုံရေးထိန်းသိမ်းရန် အသုံးပြုပါသည်။</p></Section>
          <Section number="၃" title="AI လုပ်ဆောင်မှု"><p>ပါဝင်ပစ္စည်းနှင့် စားစရာခန်းအချက်အလက်များကို ဟင်းချက်နည်း အကြံပြုချက်အတွက် OpenRouter သို့မဟုတ် သတ်မှတ်ထားသော AI ဝန်ဆောင်မှုသို့ ပေးပို့နိုင်ပါသည်။</p></Section>
          <Section number="၄" title="တတိယပါတီ ဝန်ဆောင်မှုပေးသူများ"><p>Supabase သည် အကောင့်နှင့် ဒေတာသိမ်းဆည်းမှု၊ Firebase သည် အသိပေးချက်၊ OpenRouter သည် AI လုပ်ဆောင်မှုနှင့် MyMemory သည် မြန်မာ-အင်္ဂလိပ် ဘာသာပြန်မှုကို ပေးပါသည်။</p></Section>
          <Section number="၅" title="နည်းပညာဆိုင်ရာ မှတ်တမ်းများ"><p>စက်အမျိုးအစား၊ လည်ပတ်စနစ်၊ အက်ပ်ဗားရှင်း၊ အသုံးပြုချိန်နှင့် အမှားအချက်အလက်များကို ဝန်ဆောင်မှုတည်ငြိမ်စေရန် စုဆောင်းနိုင်ပါသည်။</p></Section>
          <Section number="၆" title="Cookies နှင့် အလားတူနည်းပညာများ"><p>BarKyanLal က ကိုယ်တိုင် browser cookies မသုံးနိုင်သော်လည်း တတိယပါတီဝန်ဆောင်မှုများက cookies သို့မဟုတ် စက်အမှတ်အသားများကို အသုံးပြုနိုင်ပါသည်။</p></Section>
          <Section number="၇" title="ဒေတာသိမ်းဆည်းမှုနှင့် လုံခြုံရေး"><p>အချက်အလက်များကို ကာကွယ်ရန် သင့်လျော်သောနည်းလမ်းများ အသုံးပြုသော်လည်း အင်တာနက်ပေါ်ရှိ မည်သည့်သိမ်းဆည်းမှုကိုမျှ အပြည့်အဝ လုံခြုံကြောင်း အာမမခံနိုင်ပါ။</p></Section>
          <Section number="၈" title="ဒေတာမျှဝေမှု"><p>ကိုယ်ရေးအချက်အလက်များကို ရောင်းချရန် မရည်ရွယ်ပါ။ လုပ်ဆောင်ချက်များအတွက် လိုအပ်ပါက ဝန်ဆောင်မှုပေးသူများနှင့် မျှဝေနိုင်ပါသည်။</p></Section>
          <Section number="၉" title="ဒေတာသိမ်းဆည်းချိန်နှင့် ဖျက်ခြင်း"><p>ဝန်ဆောင်မှုပေးရန် လိုအပ်သရွေ့ အချက်အလက်များကို သိမ်းဆည်းနိုင်ပါသည်။ အက်ပ်အတွင်း ရရှိသော ထိန်းချုပ်မှုများဖြင့် ပစ္စည်းများ၊ ဓာတ်ပုံများနှင့် အသုံးပြုသူအချက်အလက်များကို ဖျက်နိုင်ပါသည်။</p></Section>
          <Section number="၁၀" title="ကလေးများ၏ ကိုယ်ရေးလုံခြုံမှု"><p>BarKyanLal သည် ကလေးများထံမှ မလိုအပ်သော ကိုယ်ရေးအချက်အလက်များကို သိလျက် စုဆောင်းရန် မရည်ရွယ်ပါ။</p></Section>
          <Section number="၁၁" title="အခြားဝန်ဆောင်မှု လင့်ခ်များ"><p>တတိယပါတီဝဘ်ဆိုက်များနှင့် ဝန်ဆောင်မှုများကို ကျွန်ုပ်တို့က ထိန်းချုပ်ခြင်းမရှိပါ။ အသုံးမပြုမီ ၎င်းတို့၏ ကိုယ်ရေးလုံခြုံမှု မူဝါဒများကို ဖတ်ပါ။</p></Section>
          <Section number="၁၂" title="မူဝါဒပြောင်းလဲမှု"><p>ပြောင်းလဲမှုများကို အက်ပ်အတွင်း သို့မဟုတ် သင့်လျော်သောနည်းလမ်းဖြင့် အသိပေးပါမည်။</p></Section>
          <Section number="၁၃" title="ဆက်သွယ်ရန်"><p>အက်ပ်အတွင်း ဖော်ပြထားသော Team Blind Mice ၏ အကူအညီလမ်းကြောင်းမှ ဆက်သွယ်နိုင်ပါသည်။</p></Section>
        </article>
      </main>
    );
  }

  return (
    <main className="legal-page" style={{ background: colors.background, color: colors.textPrimary }}>
      <header className="legal-header">
        <button type="button" className="legal-back" onClick={() => navigate(-1)} aria-label="Go back">
          <FontAwesomeIcon icon={faArrowLeft} />
        </button>
        <div>
          <p className="legal-eyebrow">BarKyanLal</p>
          <h1>Terms & Privacy</h1>
        </div>
      </header>

      <article className="legal-card" style={{ background: colors.cardBg, borderColor: colors.cardBorder }}>
        <h2 className="legal-document-title">Terms & Conditions</h2>
        <p className="legal-effective">Effective Date: September 12, 2026</p>
        <p>These Terms and Conditions govern your use of the BarKyanLal application and services. By accessing or using BarKyanLal, you acknowledge that you have read, understood, and agreed to these Terms. If you do not agree, do not use the application.</p>

        <Section number="1" title="Use of the Application">
          <p>BarKyanLal is an AI-powered food management application for organizing food items, monitoring expiry dates, receiving reminders, and obtaining meal or recipe recommendations.</p>
          <p>You agree to use the application only for lawful purposes. You must not copy, modify, reproduce, distribute, reverse engineer, create derivative versions of, interfere with, or misuse the application or its AI-generated information.</p>
          <p>Intellectual property rights relating to BarKyanLal, including its name, design, graphics, software, and original materials, remain with Team Blind Mice or their respective owners.</p>
        </Section>
        <Section number="2" title="Food Information and Expiry Dates">
          <p>BarKyanLal does not guarantee that any food item is safe to consume. Expiry dates, storage information, food conditions, and other information may be incomplete, inaccurate, outdated, or incorrectly interpreted.</p>
          <p>You are responsible for independently checking food condition, packaging, storage, expiry or best-before information, and applicable food-safety guidance. BarKyanLal is not a substitute for professional food-safety advice or your own judgment.</p>
        </Section>
        <Section number="3" title="AI-Generated Recommendations">
          <p>AI-generated food recognition and recipe information may be inaccurate, incomplete, inappropriate, or unsuitable for a particular user. Review ingredients, quantities, preparation methods, dietary needs, and allergy considerations before following any recommendation.</p>
          <p>BarKyanLal does not guarantee the accuracy, suitability, nutritional value, or safety of AI-generated recommendations.</p>
        </Section>
        <Section number="4" title="User-Provided Information">
          <p>Users may provide food names, quantities, expiry dates, storage information, and photographs. Users are responsible for ensuring that information is reasonably accurate. Incorrect information may result in inaccurate reminders or recommendations.</p>
        </Section>
        <Section number="5" title="Notifications and Reminders">
          <p>Notifications are provided as a convenience and are not a guarantee that a food item will be identified or consumed before expiry. Delivery depends on the device, operating system, internet connection, notification settings, and third-party services.</p>
        </Section>
        <Section number="6" title="Internet Connection">
          <p>Some features require an active Wi-Fi or mobile internet connection. BarKyanLal is not responsible for interruptions, reduced functionality, or data charges caused by network providers or connectivity limitations.</p>
        </Section>
        <Section number="7" title="Availability of the Service">
          <p>We aim to keep BarKyanLal available, but do not guarantee that it will always be available, uninterrupted, error-free, or compatible with every device. We may modify, suspend, restrict, or discontinue features and may require updates.</p>
        </Section>
        <Section number="8" title="Third-Party Services">
          <p>BarKyanLal uses third-party services for cloud storage and authentication, push notifications, AI processing, and Burmese translation. Their own terms and privacy policies may also apply.</p>
          <ul><li>Supabase</li><li>Firebase Cloud Messaging</li><li>OpenRouter</li><li>MyMemory Translation API</li></ul>
        </Section>
        <Section number="9" title="Limitation of Liability">
          <p>To the extent permitted by applicable law, BarKyanLal and its developers are not responsible for losses, damages, food-related consequences, inaccurate user-entered information, inaccurate AI output, missed notifications, data loss, internet interruptions, third-party failures, or device limitations.</p>
          <p>Users remain responsible for decisions regarding food storage, preparation, and consumption.</p>
        </Section>
        <Section number="10" title="Termination"><p>We may suspend or terminate access where reasonably necessary, including misuse, unlawful activity, or violation of these Terms.</p></Section>
        <Section number="11" title="Changes to These Terms"><p>We may update these Terms from time to time. Continued use after updated Terms are published constitutes acceptance to the extent permitted by law.</p></Section>
        <Section number="12" title="Contact Us"><p>Questions or concerns may be directed to Team Blind Mice through the support contact provided in the application. Add your official support email before publishing a final legal version.</p></Section>

        <hr />

        <h2 className="legal-document-title">Privacy Policy</h2>
        <p className="legal-effective">Effective Date: September 12, 2026</p>
        <p>Team Blind Mice developed BarKyanLal as an AI-powered food management application. This Privacy Policy explains how information may be collected, used, stored, and shared.</p>
        <Section number="1" title="Information We Collect">
          <p>Depending on the features you use, BarKyanLal may process food and ingredient names, quantities, expiry dates, storage information, categories, account information, profile photos, and messages sent through support features.</p>
          <p>Images submitted through camera or image features may be processed to identify or recognize food. Some information may be sent to third-party AI services when needed to provide the requested feature.</p>
        </Section>
        <Section number="2" title="How We Use Information">
          <p>Information may be used to provide application features, track food, generate reminders, provide AI-assisted recognition and recipes, improve performance, diagnose problems, respond to support requests, and maintain security.</p>
        </Section>
        <Section number="3" title="AI Processing"><p>Ingredient and pantry information may be transmitted to OpenRouter or another configured AI provider to generate recommendations. Burmese item names may be sent to MyMemory for translation before recipe generation.</p></Section>
        <Section number="4" title="Third-Party Service Providers">
          <p>Supabase provides authentication, database storage, and server functions. Firebase Cloud Messaging provides push notifications. OpenRouter provides AI processing. MyMemory provides optional Burmese-to-English translation. These providers process data according to their own policies.</p>
        </Section>
        <Section number="5" title="Log Data"><p>Technical services may collect device type, operating-system version, application version, date and time of use, error information, and diagnostic configuration to maintain reliability.</p></Section>
        <Section number="6" title="Cookies and Similar Technologies"><p>BarKyanLal may not directly use browser cookies, but integrated third-party services may use cookies, device identifiers, or similar technologies.</p></Section>
        <Section number="7" title="Data Storage and Security"><p>We use reasonable measures to protect information, but no electronic storage or internet transmission method can be guaranteed completely secure.</p></Section>
        <Section number="8" title="Data Sharing"><p>We do not intend to sell personal information. Information may be shared with service providers when reasonably necessary to operate features, or when required by law or necessary to protect users and the application.</p></Section>
        <Section number="9" title="Data Retention and Deletion"><p>Information is retained as reasonably necessary to provide services, comply with obligations, resolve disputes, and maintain the application. Available controls may be used to remove food items, photos, and other user-provided information. Contact Team Blind Mice for account-data deletion requests.</p></Section>
        <Section number="10" title="Children's Privacy"><p>BarKyanLal is not intended to knowingly collect unnecessary personal information from children. Concerns may be raised through the application support contact.</p></Section>
        <Section number="11" title="Links to Other Services"><p>Third-party websites and services are not controlled by us. Review their privacy policies before using them.</p></Section>
        <Section number="12" title="Changes to This Privacy Policy"><p>Changes will be reflected by publishing an updated version in the application or through another appropriate method.</p></Section>
        <Section number="13" title="Contact Us"><p>Contact Team Blind Mice through the support contact provided in the application. Add your official support email before publishing a final legal version.</p></Section>
      </article>
    </main>
  );
}
