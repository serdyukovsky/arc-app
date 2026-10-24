/// <reference path="../pb_data/types.d.ts" />
// Задачи (to-do): разовые дела. Не привычки (нет расписания) и не мысли (их видно, пока не сделаны).
// Приложение читает и пишет свои задачи напрямую; бот — через superuser (/задача, /задачи, утро).
migrate((app) => {
  const users = app.findCollectionByNameOrId("users")
  const tasks = new Collection({
    type: "base",
    name: "tasks",
    listRule: "@request.auth.id = user.id",
    viewRule: "@request.auth.id = user.id",
    createRule: "@request.auth.id != '' && @request.body.user = @request.auth.id",
    updateRule: "@request.auth.id = user.id && (@request.body.user:isset = false || @request.body.user = @request.auth.id)",
    deleteRule: "@request.auth.id = user.id",
    fields: [
      { name: "user", type: "relation", required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
      { name: "title", type: "text", required: true, max: 500 },
      { name: "done", type: "bool", required: false },
      { name: "done_at", type: "text", required: false, max: 40 },
      { name: "order", type: "number", required: false },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE INDEX idx_tasks_user ON tasks (user)"],
  })
  app.save(tasks)
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("tasks")) } catch (_) {}
})
