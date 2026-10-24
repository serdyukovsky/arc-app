/// <reference path="../pb_data/types.d.ts" />
// Время отметки: без него не понять, во сколько реально заканчивается день (нужно для связки со сном).
// Старые записи остаются без времени — его негде взять.
migrate((app) => {
  const c = app.findCollectionByNameOrId("habit_logs")
  if (!c.fields.getByName("created")) c.fields.add(new AutodateField({ name: "created", onCreate: true, onUpdate: false }))
  if (!c.fields.getByName("updated")) c.fields.add(new AutodateField({ name: "updated", onCreate: true, onUpdate: true }))
  app.save(c)
}, (app) => {
  const c = app.findCollectionByNameOrId("habit_logs")
  c.fields.removeByName("created")
  c.fields.removeByName("updated")
  app.save(c)
})
