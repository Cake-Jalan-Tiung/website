// The counter: the dishes that have a drawing, set out as a menu in a hairline grid. Each cell
// is the dish's drawing with + on its corner, its name (which opens it) and its price; the last
// cell leads to the full menu. The drawings arrive one after another, their pink marks (steam,
// crumbs) last, then rest; under a pointer each lifts and breathes again. Under reduced motion
// they simply stand there.
import {Field} from '../system/Field';
import {Type} from '../system/Type';
import {AddToBag, formatPrice} from './bag';
import type {Action, Dish} from './model';
import {OpenDish, openDish} from './sheet';
import c from './counter.module.css';

export function Counter({dishes, more}: {dishes: readonly Dish[]; more?: Action}) {
  return (
    <ul className={c.grid} aria-label="On the counter">
      {dishes.map((dish) => {
        const Mark = dish.drawing?.mark;
        return (
          <li key={dish.id} className={c.cell}>
            <span className={c.art}>
              <span className={c.arrive} aria-hidden>
                {Mark ? <Mark /> : null}
              </span>
              <span className={c.corner}>
                <AddToBag dish={dish} onOpen={() => openDish(dish.id)} />
              </span>
            </span>
            <Type role="caption" as="h3" className={c.name}>
              <OpenDish dish={dish} />
            </Type>
            <Type role="caption" className={c.price}>
              {formatPrice(dish.price)}
            </Type>
          </li>
        );
      })}
      {more ? (
        <li className={c.cell} data-more="">
          <a href={more.href} className={c.more}>
            <Field as="span" colour="ink" outlined={false} className={c.moreFace}>
              <Type role="subhead">Full menu →</Type>
            </Field>
          </a>
        </li>
      ) : null}
    </ul>
  );
}
