---
tags:
  - flashcard-template
---

{{ question }}

---

{{ answer }}

{% if notes %}
> **Notes:** {{ notes }}
{% endif %}

{% if source %}
*Source: {{ source }}*
{% endif %}
