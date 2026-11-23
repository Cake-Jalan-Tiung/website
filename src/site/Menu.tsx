import {Button} from '@astryxdesign/core/Button';
import {Link} from '@astryxdesign/core/Link';
import {Band, Page, Row, Stack} from '../system/layout';
import {Type} from '../system/Type';
import {MenuList, Sections, StoreFooter, StoreHeader, StoreSection} from '../storefront/sections';
import {BagBar} from '../storefront/bag';
import {formatSpan} from '../storefront/hours';
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
          <Type role="body" as="p">
            Add what you like, pay online, and collect it at the counter.
            {storefront.delivery ? (
              <>
                {' '}
                For delivery, <Link href={storefront.delivery.href}>order on Beep</Link>.
              </>
            ) : null}
          </Type>
          <Row as="nav" gap="xs" aria-label="Categories">
            {storefront.categories.map((category) => (
              <Button key={category.id} variant="ghost" size="sm" href={`#${category.id}`} label={category.name} />
            ))}
          </Row>
        </Stack>
      </Band>
      <Sections>
        {storefront.categories.map((category) => (
          <StoreSection key={category.id} id={category.id} title={category.name} note={category.servedBetween && formatSpan(category.servedBetween)}>
            <MenuList dishes={category.dishes} store={storefront} />
          </StoreSection>
        ))}
      </Sections>
      <BagBar store={storefront} />
    </Page>
  );
}
