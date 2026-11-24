/** Number of decimals worth showing for a slider step (0.01 shows two, 1 shows none). */
const decimals = (step) => (Math.round(step) === step ? 0 : Math.min(3, String(step).split('.')[1]?.length ?? 2));

/** One control for one parameter definition (see params.js): a slider, a select, a switch or a colour picker. */
function Control({ id, def, value, onChange }) {
  if (def.type === 'range') {
    return (
      <label className="art-field" htmlFor={id}>
        <span className="art-field__label">{def.label}</span>
        <output className="art-field__value">{Number(value).toFixed(decimals(def.step))}</output>
        <input id={id} className="art-range" type="range" min={def.min} max={def.max} step={def.step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      </label>
    );
  }
  if (def.type === 'select') {
    return (
      <label className="art-field art-field--inline" htmlFor={id}>
        <span className="art-field__label">{def.label}</span>
        <select id={id} className="art-select" value={value} onChange={(e) => onChange(e.target.value)}>
          {def.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    );
  }
  if (def.type === 'toggle') {
    return (
      <div className="art-field art-field--inline">
        <span className="art-field__label" id={`${id}-label`}>
          {def.label}
        </span>
        <button type="button" role="switch" aria-checked={value} aria-labelledby={`${id}-label`} className={`switch${value ? ' is-on' : ''}`} onClick={() => onChange(!value)}>
          <span className="switch__thumb" />
        </button>
      </div>
    );
  }
  return (
    <label className="art-field art-field--inline" htmlFor={id}>
      <span className="art-field__label">{def.label}</span>
      <input id={id} className="art-color" type="color" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

/** The controls for a whole schema, in the order the piece declares them. */
export default function ParamControls({ schema, values, onChange, idPrefix = 'art-param' }) {
  return (
    <div className="art-params">
      {Object.entries(schema).map(([key, def]) => (
        <Control key={key} id={`${idPrefix}-${key}`} def={def} value={values[key]} onChange={(v) => onChange(key, v)} />
      ))}
    </div>
  );
}
