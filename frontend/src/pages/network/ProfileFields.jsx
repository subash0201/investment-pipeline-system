// Form pieces shared by Join and Edit profile: actor type, SDG interests, collections to follow.
import { Field } from '../../components/ui.jsx'

export function ActorPicker({ reference, value, onChange, error }) {
  return (
    <Field label="I am a…" required error={error}>
      <div className="choice-grid" role="radiogroup">
        {reference.actor_types.map((a) => (
          <label key={a.key} className={`choice ${value === a.key ? 'on' : ''}`}>
            <input type="radio" name="actor_type" value={a.key} checked={value === a.key} onChange={() => onChange(a.key)} />
            {a.label}
          </label>
        ))}
      </div>
    </Field>
  )
}

function toggle(list, item) {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item]
}

export function SdgPicker({ value, onChange }) {
  return (
    <Field label="SDGs you care about (shapes your recommendations)">
      <div className="choice-grid choice-grid-tight">
        {Array.from({ length: 17 }, (_, i) => i + 1).map((n) => (
          <label key={n} className={`choice ${value.includes(n) ? 'on' : ''}`}>
            <input type="checkbox" checked={value.includes(n)} onChange={() => onChange(toggle(value, n))} />
            SDG {n}
          </label>
        ))}
      </div>
    </Field>
  )
}

export function CollectionPicker({ reference, value, onChange }) {
  return (
    <Field label="Portfolio collections to follow">
      <div className="choice-grid">
        {reference.collections.map((c) => (
          <label key={c.key} className={`choice ${value.includes(c.key) ? 'on' : ''}`}>
            <input type="checkbox" checked={value.includes(c.key)} onChange={() => onChange(toggle(value, c.key))} />
            {c.label}
          </label>
        ))}
      </div>
    </Field>
  )
}
