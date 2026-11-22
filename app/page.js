import Image from "next/image";
import Link from "next/link";
import BackToTop from "./components/BackToTop";

const sections = [
  {
    number: "01",
    title: "حلقات تحفيظ القرآن",
    description:
      "بيئة تعليمية تساعد الطلاب على حفظ كتاب الله ومراجعته ومتابعة تقدمهم.",
  },
  {
    number: "02",
    title: "الرعاية التعليمية",
    description:
      "متابعة مستويات الطلاب وتقييم أدائهم وتوثيق إنجازاتهم التعليمية.",
  },
  {
    number: "03",
    title: "الأنشطة والفعاليات",
    description:
      "برامج وأنشطة تربوية وترفيهية تعزز ارتباط الطلاب بالمسجد.",
  },
  {
    number: "04",
    title: "التواصل مع الأسرة",
    description:
      "تعزيز التواصل بين المسجد وأولياء الأمور لمتابعة رحلة أبنائهم التعليمية.",
  },
];

export default function HomePage() {
  return (
    <main className="public-site" dir="rtl" id="top">
      <header className="public-header">
        <div className="public-container header-inner">
          <Link href="/" className="public-brand">
            <Image
              src="/images/mosque-logo.jpg"
              alt="شعار مسجد التراحم"
              width={65}
              height={65}
              priority
            />
            <span>
              <strong>مسجد التراحم</strong>
              <small>منظومة عَون الإدارية</small>
            </span>
          </Link>

          <nav className="public-nav">
            <a href="#home">الرئيسية</a>
            <a href="#about">عن المسجد</a>
            <a href="#awn">منظومة عَون</a>
            <a href="#programs">برامجنا</a>
            <a href="#contact">تواصل معنا</a>
          </nav>

          <Link href="/login" className="header-login">
            Login
          </Link>
        </div>
      </header>

      <section className="hero-section" id="home">
        <div className="public-container hero-content">
          <div className="hero-text">
            <span className="hero-label">مسجد التراحم</span>

            <h1>
              بالقرآن نرتقي،
              <br />
              وبالعون <span>نبني الأجيال</span>
            </h1>

            <p>
              رسالة تعليمية وتربوية تهدف إلى خدمة كتاب الله،
              ورعاية الطلاب، وبناء بيئة إيمانية تجمع بين
              العلم والتربية والتواصل.
            </p>

            <div className="hero-actions">
              <a href="#about" className="primary-button">
                تعرّف علينا
              </a>
            </div>

            <div className="hero-note">
              <span className="note-line" />
              تعليم · تربية · تحفيظ · عَون
            </div>
          </div>
        </div>

        <div className="hero-bottom">
          <span>مسيرة تعليمية تصنع أثرًا</span>
          <span>⌄</span>
        </div>
      </section>

      <section className="about-section" id="about">
        <div className="public-container about-content">
          <div className="section-heading">
            <span>من نحن</span>
            <h2>رسالة تتجاوز التعليم</h2>
            <p>
              نسعى إلى توفير بيئة تساعد أبناءنا على الارتباط
              بكتاب الله، وتنمية قدراتهم، وتعزيز القيم
              التربوية والأخلاقية في حياتهم.
            </p>
          </div>

          <div className="about-highlight">
            <h3>القرآن الكريم أساس رحلتنا</h3>
            <p>
              نجعل تعليم القرآن وحفظه ومراجعته محورًا
              لرحلتنا التعليمية والتربوية.
            </p>
          </div>
        </div>
      </section>

      <section className="rahma-section" id="awn">
        <div className="public-container">
          <div className="rahma-heading">
            <span>منظومة عَون الإدارية</span>
            <h2>ما هي منظومة عَون؟</h2>
            <p>
              منظومة عَون الإدارية هي منظومة رقمية أُنشئت
              من قبل مسجد التراحم لتوحيد أعماله التعليمية
              والإدارية في بيئة تقنية واحدة. ويعبّر اسم عَون
              عن المساندة والتكامل وتيسير العمل، من خلال
              ربط الإدارة والمعلمين وأولياء الأمور ومتابعة
              رحلة الطالب التعليمية في حلقات القرآن الكريم.
            </p>
          </div>

          <div className="rahma-content">
            <div className="rahma-main-card">
              <h3>من المسجد، وإلى مستقبل تعليمي أفضل</h3>
              <p>
                تهدف المنظومة إلى الارتقاء بجودة العمل
                التعليمي والإداري، وتطوير أساليب متابعة
                الطلاب، وتيسير التواصل بين المسجد والمعلمين
                وأولياء الأمور، بما يسهم في بناء تجربة تعليمية
                أكثر تنظيمًا وفاعلية.
              </p>
            </div>

            <div className="rahma-goals">
              <article>
                <span>01</span>
                <div>
                  <h3>جودة تعليمية أفضل</h3>
                  <p>
                    تطوير متابعة الحفظ والمراجعة والتقييم،
                    والاهتمام بمستوى تقدم كل طالب.
                  </p>
                </div>
              </article>

              <article>
                <span>02</span>
                <div>
                  <h3>تواصل أقرب مع أولياء الأمور</h3>
                  <p>
                    تسهيل وصول ولي الأمر إلى معلومات أبنائه
                    ومتابعة حضورهم ومستواهم وإنجازاتهم.
                  </p>
                </div>
              </article>

              <article>
                <span>03</span>
                <div>
                  <h3>تنظيم إداري متكامل</h3>
                  <p>
                    جمع أعمال الإدارة والمعلمين والطلاب
                    في منظومة واحدة تسهّل تنظيم العمل.
                  </p>
                </div>
              </article>

              <article>
                <span>04</span>
                <div>
                  <h3>متابعة تحفظ مسيرة الطالب</h3>
                  <p>
                    توثيق رحلة الطالب التعليمية وإنجازاته
                    ومراحل تقدمه بصورة منظمة.
                  </p>
                </div>
              </article>
            </div>
          </div>

          <div className="rahma-quote">
            <span>عَون</span>
            <p>
              عَون؛ تقنية تجمع الجهود، وتيسّر التعليم، وتساند رحلة الطالب.
            </p>
          </div>
        </div>
      </section>

      <section className="programs-section" id="programs">
        <div className="public-container">
          <div className="section-heading centered-heading">
            <span>ماذا نقدم؟</span>
            <h2>مجالات العناية والاهتمام</h2>
            <p>
              منظومة متكاملة من الخدمات التعليمية والتربوية
              التي تخدم الطلاب وأسرهم.
            </p>
          </div>

          <div className="programs-grid">
            {sections.map((section) => (
              <article className="program-card" key={section.number}>
                <span className="program-number">
                  {section.number}
                </span>

                <div className="program-line" />

                <h3>{section.title}</h3>

                <p>{section.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="join-section">
        <div className="public-container join-content">
          <div>
            <span className="join-label">منظومة عَون الإدارية</span>
            <h2>رحلتنا التعليمية مستمرة</h2>
            <p>
              بوابة موحدة للإدارة والمعلمين وأولياء الأمور
              لمتابعة العملية التعليمية.
            </p>
          </div>

          <Link href="/login" className="join-button">
            تسجيل الدخول
          </Link>
        </div>
      </section>

      <footer className="public-footer" id="contact">
        <div className="public-container footer-content">
          <div className="footer-brand">
            <Image
              src="/images/mosque-logo.jpg"
              alt="شعار مسجد التراحم"
              width={58}
              height={58}
            />

            <div>
              <strong>مسجد التراحم</strong>
              <span>منظومة عَون الإدارية</span>
            </div>
          </div>

          <p>لخدمة كتاب الله ورعاية الأجيال.</p>
        </div>

        <div className="footer-bottom">
          جميع الحقوق محفوظة © مسجد التراحم
        </div>
      </footer>

      <BackToTop />
    </main>
  );
}
