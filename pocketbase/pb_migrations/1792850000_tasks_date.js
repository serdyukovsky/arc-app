/// <reference path="../pb_data/types.d.ts" />
// День задачи (YYYY-MM-DD): на какой день она записана. Невыполненные из прошлых дней показываются в «сегодня».
// Уже созданным — день создания по Барнаулу (UTC+7; пользователь один).
migrate((app) => {
  const c = app.findCollectionByNameOrId("tasks")
  if (!c.fields.getByName("date")) {
    c.fields.add(new TextField({ name: "date", required: false, max: 10, pattern: "^(\\d{4}-\\d{2}-\\d{2})?$" }))
    app.save(c)
  }
  const records = app.findAllRecords("tasks")
  for (const r of records) {
    if (r.getString("date")) continue
    const created = new Date(r.getDateTime("created").string().replace(" ", "T"))
    const local = new Date(created.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10)
    r.set("date", local)
    app.save(r)
  }
}, (app) => {
  const c = app.findCollectionByNameOrId("tasks")
  c.fields.removeByName("date")
  app.save(c)
})
