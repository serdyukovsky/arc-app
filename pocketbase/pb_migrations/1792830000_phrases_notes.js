/// <reference path="../pb_data/types.d.ts" />
// Фразы и мысли (перенесено из routine-bot). Доступ — только у сервиса уведомлений (superuser):
// правила null = из приложения не читаются и не пишутся.
//   phrases: slot 'closing' — закрытие вечернего блока; 'own' — свои (/фраза), в доводчике и иногда в закрытии
//   notes:   /мысль — только копятся и выгружаются в таблицу, бот их никогда не показывает
migrate((app) => {
  const phrases = new Collection({
    type: "base",
    name: "phrases",
    listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { name: "slot", type: "text", required: true, max: 20 },
      { name: "text", type: "text", required: true, max: 1000 },
      { name: "last_shown_at", type: "text", required: false, max: 40 },
      { name: "is_active", type: "bool", required: false },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE INDEX idx_phrases_slot ON phrases (slot)"],
  })
  app.save(phrases)

  const notes = new Collection({
    type: "base",
    name: "notes",
    listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { name: "text", type: "text", required: true, max: 5000 },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
    ],
  })
  app.save(notes)

  const CLOSING = [
    "Готово. Спокойной ночи",
    "Всё закрыто. День можно отпускать",
    "Порядок. До утра",
    "Закрыто",
    "Готово. На сегодня всё",
    "Всё. День закончен",
  ]
  for (const text of CLOSING) {
    const r = new Record(phrases)
    r.set("slot", "closing")
    r.set("text", text)
    r.set("is_active", true)
    app.save(r)
  }
}, (app) => {
  for (const name of ["notes", "phrases"]) {
    try { app.delete(app.findCollectionByNameOrId(name)) } catch (_) {}
  }
})
