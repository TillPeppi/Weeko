# Weeko — Wochen-Import-Schema (v1)

> **Generiert aus** `src/schemas/week.ts` (Zod) via `npm run schema:docs` — nicht von Hand editieren.
>
> **Zweck:** Dieses Dokument bekommt die externe Planungs-KI. Sie liefert am
> Sonntag eine Woche als JSON in genau diesem Format. Weeko validiert den
> Import strikt gegen dieses Schema.

## Regeln für die Planungs-KI

- `schemaVersion` ist immer `1`.
- Alle Zeiten sind `HH:mm` (24h). Blöcke liegen zwischen **05:00 und 24:00**, `end` muss nach `start` liegen (sonst wird der Import abgelehnt).
- Jedes `days[].date` muss in der angegebenen ISO-Woche (`week.year` / `week.isoWeek`) liegen; keine doppelten Tage.
- Block-Typen: `work | handball | training | dog | meal | hobby | task | free`.
- `title` ist frei formulierbarer Anzeigetext (Sprache egal).
- `details` ist typspezifisch, z. B. für `training`: `{ "sessionTemplate": "hyrox" | "weighted-calisthenics" | "upper-short", "intensity": "low" | "medium" | "high" }`.
- `tasks[].context` (z. B. `{ "location": "home" }`) wird gespeichert, aber erst in Phase 3 ausgewertet.

### Planungs-Leitplanken (Warnungen, kein Hard-Fail)

1. Kein großes Eigentraining (≥ 60 min oder `intensity: "high"`) am Tag **vor** einem Handball-Tag.
2. Mittwoch & Sonntag sind Regenerationsanker — dort kein intensives Training.
3. Große Sessions nur an Tagen **ohne nachfolgendes Handball** (praktisch: Fr/Sa).
4. Blöcke eines Tages dürfen sich nicht überlappen.

## JSON Schema (Draft-07)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "schemaVersion": {
      "type": "number",
      "const": 1
    },
    "week": {
      "type": "object",
      "properties": {
        "year": {
          "type": "integer",
          "minimum": 2020,
          "maximum": 2100
        },
        "isoWeek": {
          "type": "integer",
          "minimum": 1,
          "maximum": 53
        }
      },
      "required": [
        "year",
        "isoWeek"
      ],
      "additionalProperties": false
    },
    "days": {
      "minItems": 1,
      "maxItems": 7,
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "date": {
            "type": "string",
            "description": "Calendar date as YYYY-MM-DD."
          },
          "blocks": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "type": {
                  "type": "string",
                  "enum": [
                    "work",
                    "handball",
                    "training",
                    "dog",
                    "meal",
                    "hobby",
                    "task",
                    "free"
                  ]
                },
                "start": {
                  "type": "string",
                  "pattern": "^(?:([01]\\d|2[0-3]):([0-5]\\d)|24:00)$",
                  "description": "Time of day as HH:mm (24h). 24:00 is allowed as end-of-day."
                },
                "end": {
                  "type": "string",
                  "pattern": "^(?:([01]\\d|2[0-3]):([0-5]\\d)|24:00)$",
                  "description": "Time of day as HH:mm (24h). 24:00 is allowed as end-of-day."
                },
                "title": {
                  "type": "string",
                  "minLength": 1,
                  "description": "Display title. Any language — shown verbatim."
                },
                "details": {
                  "description": "Type-specific payload. training: { sessionTemplate?: string, intensity?: \"low\"|\"medium\"|\"high\" }. task: { taskCategory?: string }.",
                  "type": "object",
                  "propertyNames": {
                    "type": "string"
                  },
                  "additionalProperties": {}
                }
              },
              "required": [
                "type",
                "start",
                "end",
                "title"
              ],
              "additionalProperties": false,
              "description": "One scheduled block on a day timeline."
            }
          }
        },
        "required": [
          "date",
          "blocks"
        ],
        "additionalProperties": false,
        "description": "One calendar day with its blocks."
      }
    },
    "tasks": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "title": {
            "type": "string",
            "minLength": 1
          },
          "category": {
            "type": "string",
            "minLength": 1,
            "description": "Free-form category key, e.g. \"mealprep\", \"errands\", \"guitar\"."
          },
          "estimatedMinutes": {
            "type": "integer",
            "exclusiveMinimum": 0,
            "maximum": 9007199254740991
          },
          "preferredWindow": {
            "description": "Optional preferred execution window.",
            "type": "object",
            "properties": {
              "day": {
                "type": "string",
                "description": "Calendar date as YYYY-MM-DD."
              },
              "start": {
                "type": "string",
                "pattern": "^(?:([01]\\d|2[0-3]):([0-5]\\d)|24:00)$",
                "description": "Time of day as HH:mm (24h). 24:00 is allowed as end-of-day."
              },
              "end": {
                "type": "string",
                "pattern": "^(?:([01]\\d|2[0-3]):([0-5]\\d)|24:00)$",
                "description": "Time of day as HH:mm (24h). 24:00 is allowed as end-of-day."
              }
            },
            "required": [
              "day",
              "start",
              "end"
            ],
            "additionalProperties": false
          },
          "context": {
            "description": "Reserved for Phase 3 (e.g. { \"location\": \"home\" }). Stored, ignored in Phase 1.",
            "type": "object",
            "propertyNames": {
              "type": "string"
            },
            "additionalProperties": {}
          }
        },
        "required": [
          "title",
          "category"
        ],
        "additionalProperties": false,
        "description": "A task belonging to the week (not bound to a fixed time)."
      }
    }
  },
  "required": [
    "schemaVersion",
    "week",
    "days"
  ],
  "additionalProperties": false,
  "description": "Weekly plan for Weeko, produced by an external planning AI."
}
```

## Beispielwoche

```json
{
  "schemaVersion": 1,
  "week": {
    "year": 2026,
    "isoWeek": 28
  },
  "days": [
    {
      "date": "2026-07-06",
      "blocks": [
        {
          "type": "work",
          "start": "07:30",
          "end": "17:00",
          "title": "Arbeit (Office)"
        },
        {
          "type": "handball",
          "start": "18:30",
          "end": "20:30",
          "title": "Handball-Training"
        },
        {
          "type": "dog",
          "start": "20:45",
          "end": "21:00",
          "title": "Hunderunde"
        }
      ]
    },
    {
      "date": "2026-07-07",
      "blocks": [
        {
          "type": "work",
          "start": "07:30",
          "end": "17:00",
          "title": "Arbeit (Office)"
        },
        {
          "type": "meal",
          "start": "17:30",
          "end": "18:00",
          "title": "Abendessen"
        },
        {
          "type": "handball",
          "start": "19:30",
          "end": "22:00",
          "title": "Handball-Training"
        }
      ]
    },
    {
      "date": "2026-07-08",
      "blocks": [
        {
          "type": "work",
          "start": "07:30",
          "end": "17:00",
          "title": "Arbeit (Office)"
        },
        {
          "type": "hobby",
          "start": "19:00",
          "end": "21:00",
          "title": "Trading-Abend"
        },
        {
          "type": "dog",
          "start": "20:45",
          "end": "21:00",
          "title": "Hunderunde"
        }
      ]
    },
    {
      "date": "2026-07-09",
      "blocks": [
        {
          "type": "work",
          "start": "07:30",
          "end": "17:00",
          "title": "Arbeit (Homeoffice)"
        },
        {
          "type": "dog",
          "start": "13:00",
          "end": "13:45",
          "title": "Hund Mittagsrunde"
        },
        {
          "type": "handball",
          "start": "19:30",
          "end": "22:00",
          "title": "Handball-Training"
        }
      ]
    },
    {
      "date": "2026-07-10",
      "blocks": [
        {
          "type": "work",
          "start": "07:30",
          "end": "17:00",
          "title": "Arbeit (Homeoffice)"
        },
        {
          "type": "dog",
          "start": "13:00",
          "end": "13:45",
          "title": "Hund Mittagsrunde"
        },
        {
          "type": "training",
          "start": "17:30",
          "end": "19:00",
          "title": "Weighted Calisthenics",
          "details": {
            "sessionTemplate": "weighted-calisthenics",
            "intensity": "high"
          }
        }
      ]
    },
    {
      "date": "2026-07-11",
      "blocks": [
        {
          "type": "training",
          "start": "10:00",
          "end": "11:30",
          "title": "Hyrox-Session",
          "details": {
            "sessionTemplate": "hyrox",
            "intensity": "high"
          }
        },
        {
          "type": "free",
          "start": "14:00",
          "end": "18:00",
          "title": "Freizeit"
        }
      ]
    },
    {
      "date": "2026-07-12",
      "blocks": [
        {
          "type": "free",
          "start": "10:00",
          "end": "12:00",
          "title": "Regeneration / Spaziergang"
        },
        {
          "type": "hobby",
          "start": "16:00",
          "end": "17:00",
          "title": "Gitarre"
        }
      ]
    }
  ],
  "tasks": [
    {
      "title": "Meal-Prep für die Woche",
      "category": "mealprep",
      "estimatedMinutes": 60,
      "preferredWindow": {
        "day": "2026-07-12",
        "start": "17:00",
        "end": "20:00"
      },
      "context": {
        "location": "home"
      }
    },
    {
      "title": "Wocheneinkauf",
      "category": "errands",
      "estimatedMinutes": 45,
      "preferredWindow": {
        "day": "2026-07-11",
        "start": "12:00",
        "end": "14:00"
      }
    },
    {
      "title": "Gitarre üben",
      "category": "guitar",
      "estimatedMinutes": 30
    }
  ]
}
```
