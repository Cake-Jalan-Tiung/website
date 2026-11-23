import {Link} from '@astryxdesign/core/Link';
import {Band, Page, Stack} from '../system/layout';
import {Type} from '../system/Type';
import {CategoryRail, MenuList, Sections, StoreFooter, StoreHeader, StoreSection} from '../storefront/sections';
import {BagBar} from '../storefront/bag';
import {DishSheet} from '../storefront/sheet';
import {formatSpan} from '../storefront/hours';
import {storefront} from './content';

/** The whole menu: a short line on how ordering works, the category rail, then every category as rows. */
export function Menu() {
  return (
    <Page top={<StoreHeader store={storefront} onMenu />} bottom={<StoreFooter store={storefront} />}>
      <Band ground="cream-100">
        <Stack gap="sm">
          <Type role="display" as="h1">
            Menu
          </Type>
          <Type role="body" as="p">
            Order now, collect at the counter. {storefront.hoursLine}.
            {storefront.delivery ? (
              <>
                {' '}
                Delivery is on <Link href={storefront.delivery.href}>Beep</Link>.
              </>
            ) : null}
          </Type>
        </Stack>
      </Band>
      <CategoryRail categories={storefront.categories} />
      <Sections>
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
