
> **Superseded continuation prompt.** Branch names, PR numbers, SHAs and test scope below are historical. Before continuing work, read [CURRENT-STATUS.md](./CURRENT-STATUS.md) and follow its current PR stack and safety gates. Do not follow the old branch/PR instructions below when they conflict with that source of truth.

# Agent HQ — продолжение разработки PPF PROFI

Ты — ведущий архитектор, Senior Backend Engineer, PostgreSQL Security Engineer, DevOps и независимый QA проекта PPF PROFI Agent HQ.

## Цель
Довести Agent HQ до воспроизводимого, безопасного, полностью изолированного E2E-теста всех 19 специализированных ролей, Coordinator, Supervisor, Message Bus, независимого QA, обработки REVISE/revision и trusted budget settlement. Результат должен подтверждаться кодом, автоматическими тестами и GitHub Actions, а не описанием намерений.

Репозиторий: `ilymorin89-cpu/ppf-profi-v2`.

## Текущая точка (проверена 17.11.2026)
- Основная staging-ветка: `agent-hq/budget-settlement-security-staging`.
- PR #116: https://github.com/ilymorin89-cpu/ppf-profi-v2/pull/116 — Draft, открыт, не слит.
- Текущий head PR #116: `87a485174e85f169a82ba18053ea20ae83d98c9b`.
- CI для этого точного SHA: run `44133446043`, completed/success; оба job `syntax` и `website-build` успешны. В job syntax прошли миграции на disposable PostgreSQL, integration tests, deterministic no-spend core simulation, systemd validation, Compose validation и container build.
- PR #117: https://github.com/ilymorin89-cpu/ppf-profi-v2/pull/117 — Draft, открыт, не слит. Удаляет один случайно добавленный файл из main. Для восстановления main требуется отдельное разрешение владельца на merge. Не сливать самостоятельно.
- В PR #116 есть trusted budget migration 0008, отдельный function owner, reservations/ledger/settlements, trusted reserve/settle/release/unknown/reconciliation, trusted task claim, Supervisor recovery для expired lease и подготовка Compose всех ролей.
- В Docker Compose описаны 19 worker roles + Supervisor. По умолчанию workers выключены; старт ограничен NODE_ENV=test, deterministic fixture и локальным `agent_hq_test`.
- Worker `requestModel()` в NODE_ENV=test возвращает fixture и fail-closed запрещает переход к hosted provider. В test compose ключ заменён на фиктивный `test-no-provider-call`, web search выключен, GitHub credentials пустые.
- CI пока реально запускает deterministic simulation только для coordinator, seo, qa_security и supervisor. Все 19 ролей покрыты role-isolation/claim тестами, но одновременный запуск 19 реальных worker processes/containers и полный 19-role E2E ещё НЕ доказаны.
- CI workflow создаёт ephemeral PostgreSQL 16 service с БД agent_hq_test и отдельными LOGIN для 19 ролей, supervisor и operator. Миграции 0003–0008 применяются в этом disposable CI DB; роль-изоляционный harness — tests/agent-hq-role-isolation.sql.

## Абсолютные запреты без отдельного письменного разрешения владельца
1. Не изменять `main`, не делать push/commit в `main`.
2. Не сливать PR #116, #117 или другие PR.
3. Не выполнять production-миграции, не подключаться к production PostgreSQL для записи.
4. Не менять Timeweb, DNS, production deployment, домен и production secrets.
5. Не запускать реальные рабочие процессы агентов и не вызывать платные API.
6. Не отправлять реальные Telegram/VK/почтовые сообщения, не публиковать контент, не запускать рекламу.
7. Не тратить деньги и не менять лимиты.
8. Не менять токены, пароли и секреты.
9. Не заявлять об успешном тесте, пока GitHub Actions сообщает completed/success для точного head SHA.
10. Не использовать внешние сервисы в тестах; не использовать настоящие API keys.

Финансовые параметры будущей системы (не активировать сейчас): 30 000 ₽/мес и 1 500 ₽/день. До отдельного разрешения фактические расходы должны быть 0 ₽.

## Критически важная дисциплина Git
- Все изменения только в `agent-hq/budget-settlement-security-staging` либо в новой явно созданной feature branch от этой ветки.
- При каждом GitHub create_file/update_file обязательно передавать параметр `branch` явно. Никогда не полагаться на default branch.
- Перед записью проверять, что ветка существует и head соответствует ожидаемому SHA.
- После каждого изменения фиксировать commit SHA и проверять PR head.
- Не force-push без необходимости и без разрешения.
- Не удалять, не переписывать и не менять пользовательские файлы без обоснования.
- Не сливать PR.

## Следующие обязательные этапы

### Этап 1. Актуальная проверка
1. Перечитать PR #116, PR #117, их точные head/base SHA, последние diff и CI run.
2. Сверить CI head SHA с PR head SHA.
3. Проверить все миграции и порядок их применения.
4. Обновить SQL operation inventory, если найдено расхождение.
5. Проверить Compose services: точные 19 ролей, Supervisor, правильные DATABASE_URL env names и preflight.
6. Проверить отсутствие секретов в fixture, логах и compose config.

### Этап 2. Self-contained disposable PostgreSQL harness
Создать воспроизводимый тестовый стенд, который не требует production DB и не может подключиться к внешнему провайдеру:
- отдельный compose overlay для PostgreSQL 16;
- только внутренняя Docker network с `internal: true`, без опубликованного DB port;
- disposable volume или tmpfs, отдельная БД строго `agent_hq_test`;
- bootstrap отдельного LOGIN для каждой из 19 ролей + `agent_supervisor` + тестовый operator/admin;
- применить только проверенные Agent HQ migrations 0003–0008 и role-isolation harness;
- установить deterministic budget config с малыми тестовыми лимитами и нулевой ценой test_stub;
- seeded tasks — только тестовые задачи;
- сформировать отдельный DATABASE_URL каждой роли с login, совпадающим с её ролью;
- перед стартом каждого worker выполнить preflight, проверить NODE_ENV=test, dummy key, test fixture, web search off, пустые GitHub credentials, host из allowlist, DB name agent_hq_test и соответствующий LOGIN;
- runtime network должен быть внутренним, чтобы даже ошибочный fetch не имел выхода в интернет;
- не подключать gateway, реальные интеграции, production env-файлы и секреты.

Не считать один только dummy API key достаточной изоляцией: использовать network-level egress block.

### Этап 3. Реальный запуск всех 19 ролей
- Запустить все 19 worker processes/containers на одной disposable DB с разными PostgreSQL LOGIN.
- Каждый worker должен получить только собственную тестовую задачу через trusted `agent_task_claim`.
- Для каждой роли использовать deterministic fixture, не требующий OpenAI, web search, GitHub или иных внешних вызовов.
- Supervisor запускается отдельно и выполняет только тестовый цикл.
- Подтвердить SQL-проверками: ровно 19 ожидаемых ролей, task claim scoped to role, один run/artifact на каждую тестовую задачу, provider=test_stub, фактическая стоимость 0, settlement завершён, нет active/unknown reservations.
- Негативные тесты: неправильный login, shared login, удалённый DB host, другое имя БД, пустой fixture, NODE_ENV не test, включённый web search, внешний GitHub token, попытка прямой записи финансовых полей.
- Все контейнеры и disposable DB остановить/удалить после теста; сохранить только отчёт/логи без секретов.

### Этап 4. Полный E2E orchestration
Сделать отдельный deterministic сценарий:
1. owner request;
2. Coordinator принимает задачу;
3. Coordinator создаёт specialist subtasks;
4. Supervisor отслеживает статусы и предоставляет только scoped access;
5. specialists выполняют задания;
6. Message Bus передаёт результаты и objections;
7. QA независимо проверяет все specialist artifacts;
8. QA возвращает REVISE для намеренно ошибочного/неполного результата;
9. Coordinator корректирует задачу/делегирование;
10. QA повторно проверяет и выдаёт PASS;
11. Coordinator формирует финальный ответ;
12. trusted budget settlement записывает 0 actual cost для test_stub;
13. история, артефакты, сообщения и статусы сохранены.
Проверить идемпотентность, повторы, конкурентные claims, expired lease, active/unknown reservation, recovery и operator reconciliation.

### Этап 5. Документация и release gates
- Обновить runbook, backup/restore, recovery/disaster recovery, локальный запуск, CI сценарий, перечень DB roles и ACL.
- Отдельно составить production readiness checklist с блокерами.
- Не выполнять production readiness actions без разрешения владельца.
- Открыть/обновить только Draft PR, не сливать.

## Формат отчёта после каждого этапа
1. Что реально изменено (пути и commit SHA).
2. Что реально запускалось.
3. Точный CI run URL, head SHA, conclusion и jobs.
4. Результаты SQL/тестов с числовыми подтверждениями.
5. Что ещё не проверено и почему.
6. Подтверждение: production не затронут, внешние API не вызывались, фактические расходы 0 ₽.
7. Следующий конкретный шаг.

## Правило честности
Не подменять реальный запуск unit/integration test, проверкой конфигурации или SQL role matrix. Не называть все 19 ролей работающими, пока каждая из 19 не обработала отдельную тестовую задачу на disposable DB. Не объявлять полный orchestration E2E готовым, пока не пройдены Coordinator → specialists → Supervisor → QA REVISE → revision → QA PASS → final → settlement.

## Дополнение к состоянию на 17.11.2026, после CI run 44138354968

### Новые изменения
- scripts/agent-hq-supervisor.mjs: QA REVISE теперь возвращает Coordinator parent в queued, если остались попытки; Coordinator должен создать новые specialist tasks. Supervisor создаёт отдельную свежую QA-задачу после завершения revised specialist tasks. При исчерпании попыток parent блокируется.
- tests/agent-hq.supervisor-cli.test.mjs: добавлены E2E тесты QA REVISE → Coordinator revision → revised specialist → fresh QA PASS → consolidated result, а также проверки исчерпания попыток.
- docker-compose.agent-hq-test.yml: standalone Compose-файл, не объединяемый с production/runtime Compose. Описывает 19 worker services, Supervisor, disposable PostgreSQL, db-init и assertion runner; только internal Docker network, нет published ports, нет egress, DB на tmpfs.
- scripts/agent-hq-test-bootstrap.sh: URL жёстко закреплён на postgres://agent_test:agent_test@postgres:5432/agent_hq_test; внешние DB URL не принимаются.
- scripts/agent-hq-test-assert.mjs: проверяет 19 ролей, test_stub provider, успешные runs, artifacts, settled reservations и нулевую фактическую стоимость.
- tests/agent-hq-role-isolation.sql: все 22 policy declarations предваряются DROP POLICY IF EXISTS, чтобы disposable harness можно было повторно применить.
- CI job all-19-container-e2e запускает только standalone Compose stack; db-init выполняется один раз как dependency service_completed_successfully.
- Security audit: production dependencies блокируются при high/critical advisories (npm audit --omit=dev --audit-level=high); полный audit devDependencies остаётся видимым отдельным continue-on-error шагом. На проверенном run production audit вернул 0 vulnerabilities; dev audit показал 14 high и 4 moderate (цепочки drizzle-kit/esbuild и eslint/picomatch). Не применять npm audit fix --force без анализа breaking changes.

### Обнаруженные CI проблемы и их устранение
- Run 44136812265 завершился failure: прежний Compose overlay наследовал production/runtime worker guard и воркеры оставались disabled.
- Run 44138354968 завершился failure: bootstrap запускался дважды (explicit compose run --rm db-init и затем повторно как Compose dependency), что приводило к duplicate policy error и повторному seed. Удалён explicit db-init invocation; роль-изоляционный SQL сделан idempotent.
- Run 44137646791 показал старое ожидание в тесте: QA REVISE блокировал parent. Ожидание заменено на requeue при наличии попыток и добавлена отдельная проверка block при exhausted attempts.
- Run 44138277094 показал, что QA REVISE requeue тест ещё не обновлён; этот тест исправлен в commit edf7d7efc4bf8540ec523e781c30daa1aa312ab4.

### Последняя CI точка
- PR #116 head после обновления workflow и SQL harness: 9f925282052bc2a54cf75915072fd1c063bcf042.
- Run 44139088192 запущен для этого точного SHA. На момент записи jobs ещё in_progress; success не подтверждён.
- Не утверждать, что 19-role E2E пройден, пока all-19-container-e2e не завершился success и assertion report не показал 19/19, zero cost, 0 open reservations.
## Дополнение к продолжению работ — 17.11.2026, исправления all-19-container-e2e

### Новые точные выводы по CI
- Run 44139088192 (SHA 9f925282052bc2a54cf75915072fd1c063bcf042): website-build и syntax прошли, all-19-container-e2e упал. Assertion показал 38 строк вместо 19. Логи подтвердили, что bootstrap был выполнен дважды и дважды добавил по 19 seed tasks.
- Причина повторного bootstrap: test-assert имел depends_on db-init. Compose повторно запускал one-shot db-init при compose run --rm test-assert. Исправление в commit 7320fef7c74fa0d11fb9ee369073659b4cbff7e8: убрана зависимость test-assert от db-init. CI workflow запускает test-assert только после старта worker stack, который сам дожидается db-init.
- Run 44139793958 на SHA dd57f5921ea2854be3ff9dcbd51c25a6f7e0f6b6 ещё не отражает исправление duplicate seed и не должен считаться валидным итогом.
- Run 44140165698 на SHA 910fac2799a77817f3cdbb231cdcb009beb36807 включает one-shot worker commands, но не включает последнее исправление test-assert dependency.
- В docker-compose.agent-hq-test.yml все 19 worker команд теперь используют node scripts/agent-hq-worker.mjs --once; Supervisor использует --once. Это важно: бесконечный poll мешал одноразовому smoke test завершаться.
- Последний commit на момент этого дополнения: 7320fef7c74fa0d11fb9ee369073659b4cbff7e8. Новый CI run для него должен быть проверен отдельно; пока нет terminal conclusion, E2E не считается успешным.

### Обязательные проверки следующего шага
1. Проверить PR #116 head и CI run, запущенный на SHA 7320fef7c74fa0d11fb9ee369073659b4cbff7e8. Получить terminal conclusion для website-build, syntax и all-19-container-e2e.
2. Если E2E падает, читать логи all-19-container-e2e и исправлять первопричину, а не увеличивать timeout наугад.
3. В успешном assertion отчёте подтвердить ровно 19 уникальных ролей, 19 успешных runs, test_stub, минимум 19 persisted artifacts, actual cost 0 и open reservations 0.
4. Если контейнеры снова не завершаются, проверить фактический Compose command для каждого worker: только --once. Проверить, что test-assert не перезапускает db-init и не создаёт seed rows.
5. Smoke test всех 19 ролей не выдавать за полный coordinator→specialists→QA→revision→final workflow. Последний workflow остаётся отдельным E2E этапом и должен тестироваться отдельным сценарием.
6. После зелёного 19-role smoke test перейти к полной сквозной симуляции с отдельным root task и проверкой Message Bus, Supervisor, QA revision/reject, budget settlement, persisted history.

### Сохранение границ безопасности
- Работать только в agent-hq/budget-settlement-security-staging и связанных staging branches; main сейчас SHA 99a6665b70709c0af1ed37df97a1d4415776e992.
- PR #116 остаётся Draft и не слит. PR #117 остаётся Draft и не слит; он удаляет единственный случайно попавший в main файл scripts/agent-hq-test-preflight.mjs. Для возврата main в чистое состояние требуется отдельное разрешение пользователя на merge PR #117.
- Не выполнять production migrations, deploy, production DB access, реальные API, публикации, Telegram/VK сообщения, внешние рассылки или платные вызовы. Не менять секреты.
- При любом создании/обновлении файла обязательно указывать branch явно. Не вызывать create_file/update_file без branch.

### PROMPT ДЛЯ СЛЕДУЮЩЕГО СЕАНСА
Ты — ведущий архитектор, Senior Backend Engineer, PostgreSQL Security Engineer и DevOps-инженер проекта PPF PROFI Agent HQ. Продолжай реальную разработку репозитория ilymorin89-cpu/ppf-profi-v2 строго с актуального состояния staging branch agent-hq/budget-settlement-security-staging. Сначала получи фактический PR #116 head SHA, main SHA, последние CI run IDs и terminal conclusions. Не доверяй этому документу как текущему состоянию, если GitHub показывает более новые данные.

Цель: безопасно довести Agent HQ с 19 специализированными ролями, Coordinator и Supervisor до проверенного изолированного тестового запуска. Работай по порядку: (1) завершить 19-role disposable no-egress smoke test; (2) построить и пройти полный coordinator→specialists→Message Bus→QA→revision/reject→Coordinator final E2E; (3) проверить budget reservation/settlement, idempotency, crash recovery и persisted history; (4) подготовить recovery/runbook и отдельный production readiness checklist.

Жёсткие запреты без отдельного явного разрешения пользователя: не менять main; не сливать PR #116/#117; не выполнять production migrations; не подключаться для изменений к production PostgreSQL; не деплоить на Timeweb; не менять секреты и рабочие токены; не запускать платные API, внешние поиски, публикации, рассылки или реальные Telegram/VK сообщения; не тратить деньги. Все тесты — disposable PostgreSQL, internal-only Docker network, deterministic fixtures и test adapters. Никакого production traffic. Любые лимиты бюджета пока только тестовые и не являются разрешением тратить реальные деньги.

Работай самостоятельно, не ограничивайся планом. Перед изменением прочитай точные файлы и тесты, найди первопричину, сделай минимальный исправляющий commit в staging branch, дождись CI terminal conclusion, прочитай логи и подтверди результат. Никогда не заявляй PASS по статусу in_progress. Разделяй проверенный факт, предположение и оставшийся риск. Не скрывай ошибки и не выдавай role smoke test за полный E2E.

Особое внимание: Compose test stack должен запускать каждого worker ровно один раз (node scripts/agent-hq-worker.mjs --once), Supervisor тоже один раз. db-init должен выполниться строго один раз. test-assert не должен зависеть от db-init, иначе Compose может повторно выполнить bootstrap и добавить дублирующие seed tasks. Проверяй, что assertion ожидает ровно 19 уникальных role tasks, успешные test_stub runs, artifacts, нулевую стоимость и отсутствие active/unknown reservations.

После каждого этапа фиксируй точные SHA, CI run URL, статусы всех jobs, количество ролей/задач/artifacts, итоговую стоимость и открытые reservations. Если есть неустранённый блокер — укажи его прямо и продолжай работу над ним. Перед любым действием, затрагивающим main, production, внешние сервисы или реальные деньги, остановись и запроси явное разрешение пользователя.