import {useDelivers} from '../storefront/delivers';
import {Link} from '@astryxdesign/core/Link';
import {Band, Page, Stack} from '../system/layout';
import {Type} from '../system/Type';
import {CategoryRail, DishStrip, MenuList, Sections, StoreFooter, StoreHeader, StoreSection} from '../storefront/sections';
import {dishesById} from '../storefront/model';
import {BagBar} from '../storefront/bag';
import {DishSheet} from '../storefront/sheet';
import {formatSpan} from '../storefront/hours';
import {PickupPromise} from '../storefront/promise';
import {storefront} from './content';

const BEST_SELLERS = {id: 'best-sellers', name: 'Best sellers'};

/** The whole menu: a short line on how ordering works, the category rail, the best sellers to choose from first, then every category as rows. */
export function Menu() {
  const delivers = useDelivers();
  return (
    <Page top={<StoreHeader store={storefront} onMenu />} bottom={<StoreFooter store={storefront} />}>
      <Band ground="cream-100">
        <Stack gap="sm">
          <Type role="display" as="h1">
            Menu
          </Type>
          <PickupPromise store={storefront} />
          <Type role="body" as="p">
            {delivers && storefront.deliveryArea ? `Order now, collect at the counter or have it delivered within ${storefront.deliveryArea.radiusKm} km.` : 'Order now, collect at the counter.'} {storefront.hoursLine}.
            {storefront.delivery && !delivers ? (
              <>
                {' '}
                Delivery is on <Link href={storefront.delivery.href}>Beep</Link>.
              </>
            ) : null}
          </Type>
        </Stack>
      </Band>
      <CategoryRail categories={[BEST_SELLERS, ...storefront.categories]} />
      <Sections dense>
        <StoreSection id={BEST_SELLERS.id} title={BEST_SELLERS.name}>
          <DishStrip dishes={dishesById(storefront, storefront.bestSellers)} />
        </StoreSection>
        {storefront.categories.map((category) => (
          <StoreSection key={category.id} id={category.id} title={category.name} note={category.servedBetween && `Served ${formatSpan(category.servedBetween)}`}>
            <MenuList dishes={category.dishes} store={storefront} />
          </StoreSection>
        ))}
      </Sections>
      <BagBar store={storefront} />
      <DishSheet store={storefront} />
    </Page>
  );
}
