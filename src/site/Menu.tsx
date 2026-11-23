import {Button} from '@astryxdesign/core/Button';
import {Band, Page, Row, Stack} from '../system/layout';
import {Type} from '../system/Type';
import {MenuList, Sections, StoreFooter, StoreHeader, StoreSection} from '../storefront/sections';
import {storefront} from './content';

/** The whole menu, one section per category, with a jump to each and the ways to order. */
export function Menu() {
  return (
    <Page top={<StoreHeader store={storefront} />} bottom={<StoreFooter store={storefront} />}>
      <Band ground="cream-100">
        <Stack gap="lg">
          <Stack gap="sm">
            <Type role="display" as="h1">
              Menu
            </Type>
            <Type role="body" as="p" ink="secondary">
              {storefront.hoursLine}
            </Type>
          </Stack>
          <Row gap="sm">
            <Button variant="primary" size="lg" href={storefront.order.delivery.href} label="Order for delivery" />
            <Button variant="secondary" size="lg" href={storefront.order.pickup.href} label="Order for pick-up" />
          </Row>
          <Row as="nav" gap="xs" aria-label="Categories">
            {storefront.categories.map((category) => (
              <Button key={category.id} variant="ghost" size="sm" href={`#${category.id}`} label={category.name} />
            ))}
          </Row>
        </Stack>
      </Band>
      <Sections>
        {storefront.categories.map((category) => (
          <StoreSection key={category.id} id={category.id} title={category.name} note={category.note}>
            <MenuList dishes={category.dishes} store={storefront} />
          </StoreSection>
        ))}
      </Sections>
    </Page>
  );
}
