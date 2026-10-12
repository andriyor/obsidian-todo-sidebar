---
title: Todo Example
tags: [todo, demo]
created: 2026-08-18
---

# Todo Example

> Sample note for screenshots — mixed states, priorities, dates, nesting.

## Today

Small stuff that has to be closed before the day ends.

- [ ] Review pull request #482 ⏫ 📅 2026-08-18 #work
- [ ] Reply to Kate about the API contract 📅 2026-08-18 #work
- [x] Morning walk, 30 min ✅ 2026-08-18 #health
- [x] Take vitamin D ✅ 2026-08-18 🔁 every day #health
- [ ] Water the plants 🔽

## This Week

Bigger items with real deadlines. Most of them have subtasks.

- [ ] Ship the settings panel 🔺 📅 2026-08-21 #work
    - [x] Wire up the toggle state ✅ 2026-08-17
    - [x] Persist to `data.json` ✅ 2026-08-17
    - [ ] Add keyboard shortcut
    - [ ] Write the README section
- [ ] Book dentist appointment 📅 2026-08-20 #life
- [ ] Renew domain before it expires ⏫ 📅 2026-08-22 #life
- [ ] Groceries #life
    - [ ] Coffee beans
    - [ ] Olive oil
    - [ ] Frozen berries
- [-] Migrate the old notes folder — cancelled, keeping as archive

## Reading

Queue of things worth finishing, not just bookmarking.

- [x] *Designing Data-Intensive Applications*, ch. 1–3 ✅ 2026-08-15 #reading
- [ ] *Designing Data-Intensive Applications*, ch. 4 #reading
- [ ] Article: [Obsidian plugin API basics](https://docs.obsidian.md) #reading
- [ ] Skim the CRDT paper someone linked in Discord

## Someday / Maybe

No dates on purpose. Nothing here is a commitment yet.

- [ ] Learn basic Go 🔽 #learning
- [ ] Build a bike repair stand #diy
- [ ] Weekend trip to the Carpathians #travel
- [ ] Try film photography with the X-T4 #photo

## Blocked

Waiting on someone else. Review this list on Mondays.

- [ ] Deploy staging environment — waiting on VPN access from IT ⏳ 2026-08-19 #work
- [ ] Sign the contract — waiting on the updated draft #work

---

## Notes

Loose context that doesn't belong to any single task.

Some plain text between task lists, so the rendering has something to
break up the checkboxes.

1. Numbered lists still look like numbered lists.
2. Second item.
3. Third item.

| Task            | Owner | Status      |
| --------------- | ----- | ----------- |
| Settings panel  | me    | in progress |
| Docs pass       | me    | not started |
| Release v0.3.0  | me    | blocked     |

```js
// even a code block, for good measure
const done = tasks.filter((t) => t.checked).length
```

- [ ] Last one, so the list doesn't end on a heading
