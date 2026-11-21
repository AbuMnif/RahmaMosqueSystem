import Image from "next/image";
import Link from "next/link";

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
    <main className="public-site" dir="rtl">
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
              <small>منظومة رحَمة الإدارية</small>
            </span>
          </Link>

          <nav className="public-nav">
            <a href="#home">الرئيسية</a>
            <a href="#about">عن المسجد</a>
            <a href="#programs">برامجنا</a>
            <a href="#contact">تواصل معنا</a>
          </nav>

          <Link href="/login" className="header-login">
            دخول المنظومة
            <span>←</span>
          </Link>
        </div>
      </header>

      <section className="hero-section" id="home">
        <div className="public-container hero-content">
          <div className="hero-text">
            <span className="hero-label">
              مسجد التراحم
            </span>

            <h1>
              بالقرآن نرتقي،
              <br />
              وبالتراحم <span>نبني الأجيال</span>
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

              <Link href="/login" className="secondary-button">
                الدخول إلى المنظومة
              </Link>
            </div>

            <div className="hero-note">
              <span className="note-line" />
              تعليم · تربية · تحفيظ · تراحم
            </div>
          </div>

          <div className="hero-logo-area">
            <div className="hero-decoration decoration-one" />
            <div className="hero-decoration decoration-two" />

            <div className="hero-logo-card">
              <Image
                src="/images/mosque-logo.jpg"
                alt="الشعار الرسمي لمسجد التراحم"
                width={430}
                height={430}
                priority
                className="hero-logo"
              />

              <div className="hero-logo-caption">
                <strong>مسجد التراحم</strong>
                <span>منظومة رحَمة الإدارية</span>
              </div>
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
            <div className="highlight-icon">۞</div>
            <h3>القرآن الكريم أساس رحلتنا</h3>
            <p>
              نجعل تعليم القرآن وحفظه ومراجعته محورًا
              لرحلتنا التعليمية والتربوية.
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
            <span className="join-label">منظومة رحَمة الإدارية</span>
            <h2>رحلتنا التعليمية مستمرة</h2>
            <p>
              بوابة موحدة للإدارة والمعلمين وأولياء الأمور
              لمتابعة العملية التعليمية.
            </p>
          </div>

          <Link href="/login" className="join-button">
            الدخول إلى المنظومة
            <span>←</span>
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
              <span>منظومة رحَمة الإدارية</span>
            </div>
          </div>

          <p>
            لخدمة كتاب الله ورعاية الأجيال.
          </p>

          <Link href="/login">
            دخول المنظومة
          </Link>
        </div>

        <div className="footer-bottom">
          جميع الحقوق محفوظة © مسجد التراحم
        </div>
      </footer>
    </main>
  );
}
