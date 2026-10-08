import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="dark-grid min-h-screen text-white">
      <header className="sticky top-0 z-50 border-b border-white/8 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-4xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="text-xl font-extrabold tracking-[0.12em]">
              PPF <span className="accent">PROFI</span>
            </div>
          </Link>
          <Link
            href="/"
            className="text-xs font-bold text-white/50 transition hover:text-white"
          >
            ← На главную
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-16">
        <div className="eyebrow">Юридическая информация</div>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
          Политика конфиденциальности
        </h1>
        <p className="mt-3 text-sm text-white/50">
          Дата последнего обновления: 8 октября 2026 года
        </p>

        <div className="mt-10 space-y-8 text-sm leading-7 text-white/70">
          <section>
            <h2 className="text-lg font-extrabold text-white">
              1. Общие положения
            </h2>
            <p className="mt-3">
              Настоящая Политика конфиденциальности определяет порядок обработки
              персональных данных пользователей сайта PPF PROFI (далее — Сайт).
            </p>
            <p className="mt-3">
              Оператор персональных данных: индивидуальный предприниматель Морин
              Илья Владимирович, ИНН 740414579370, ОГРНИП 321745600022340
              (далее — Оператор).
            </p>
            <p className="mt-3">
              Используя Сайт и отправляя заявку, пользователь подтверждает
              согласие с условиями настоящей Политики.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-white">
              2. Какие данные мы обрабатываем
            </h2>
            <ul className="mt-3 ml-5 list-disc space-y-2">
              <li>Имя пользователя или клиента;</li>
              <li>Номер телефона;</li>
              <li>Адрес выполнения работ (по желанию пользователя);</li>
              <li>Сведения об автомобиле: марка, модель, год выпуска;</li>
              <li>Фотографии автомобиля (если загружены пользователем);</li>
              <li>
                Технические данные: IP-адрес, тип браузера, cookies — собираются
                автоматически для работы Сайта.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-white">
              3. Цели обработки
            </h2>
            <ul className="mt-3 ml-5 list-disc space-y-2">
              <li>Обработка заявки и обратная связь с пользователем;</li>
              <li>Расчёт стоимости услуг и подготовка коммерческого предложения;</li>
              <li>Исполнение договора об оказании услуг;</li>
              <li>Улучшение качества сервиса.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-white">
              4. Передача данных третьим лицам
            </h2>
            <p className="mt-3">
              Персональные данные могут передаваться партнёру или мастеру,
              выполняющему работы, только в объёме, необходимом для исполнения
              заявки. Данные не передаются третьим лицам для маркетинговых целей.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-white">
              5. Хранение данных
            </h2>
            <p className="mt-3">
              Персональные данные хранятся на серверах, расположенных на
              территории Российской Федерации, в соответствии с требованиями
              Федерального закона № 152-ФЗ «О персональных данных».
            </p>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-white">
              6. Права пользователя
            </h2>
            <p className="mt-3">Пользователь имеет право:</p>
            <ul className="mt-3 ml-5 list-disc space-y-2">
              <li>Запросить информацию об обработке своих данных;</li>
              <li>Потребовать уточнения, блокирования или удаления данных;</li>
              <li>Отозвать согласие на обработку персональных данных.</li>
            </ul>
            <p className="mt-3">
              Для реализации прав направьте обращение на адрес:{" "}
              <span className="accent">kent777_09@mail.ru</span>
            </p>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-white">
              7. Cookies
            </h2>
            <p className="mt-3">
              Сайт использует технические cookies для работы сессий
              авторизации. Cookies не содержат персональных данных и не
              передаются третьим лицам.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-white">
              8. Изменения в Политике
            </h2>
            <p className="mt-3">
              Оператор вправе изменять Политику. Актуальная версия всегда
              доступна по адресу ppfprofi.ru/privacy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-white">
              9. Контакты
            </h2>
            <p className="mt-3">
              ИП Морин Илья Владимирович
              <br />
              Email: <span className="accent">kent777_09@mail.ru</span>
              <br />
              Телефон: +7 (952) 857-54-23
            </p>
          </section>
        </div>
      </div>

      <footer className="border-t border-white/8 bg-black/60">
        <div className="mx-auto flex max-w-4xl flex-col gap-4 px-6 py-10 text-sm text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs">
            © 2026 PPF PROFI. Все права защищены.
          </div>
          <Link href="/" className="text-xs hover:text-white">
            На главную →
          </Link>
        </div>
      </footer>
    </div>
  );
}