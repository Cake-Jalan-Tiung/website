import {BurungTiung, TiungCat} from '../marks/marks.generated';
import {Page} from '../system/layout';
import {CategoryTiles, DishGrid, Facts, Hero, Sections, SeasonBand, StoreFooter, StoreHeader, StoreSection, Visit, heroIdle} from '../storefront/sections';
import {dishesById} from '../storefront/model';
import {BagBar} from '../storefront/bag';
import {DishSheet} from '../storefront/sheet';
import {address, promise, storefront} from './content';
import {Shopfront, Street} from './Shopfront';

// The street plate names the road the shop is on: its address's first line without the number.
const streetName = address.lines[0].replace(/^\d+,\s*/, '');

export function Site() {
  return (
    <Page top={<StoreHeader store={storefront} />} bottom={<StoreFooter store={storefront} />}>
      <Hero
        title={promise}
        art={{engine: 'alive', ground: 'cream-100', mark: BurungTiung}}
        store={storefront}
        visual={storefront.counter ? <Shopfront dishes={dishesById(storefront, storefront.counter.dishes)} more={storefront.menu} /> : undefined}
        street={<Street plate={[streetName, address.lines[1]]} />}
      />
      <Sections>
        <Facts facts={storefront.facts} />
        <StoreSection id="best-sellers" title="Best sellers" action={{label: 'See the full menu', href: storefront.menu.href}}>
          <DishGrid dishes={dishesById(storefront, storefront.bestSellers)} />
        </StoreSection>
        <StoreSection id="explore" title="Explore the menu">
          <CategoryTiles categories={storefront.categories} menuHref={storefront.menu.href} />
        </StoreSection>
      </Sections>
      <SeasonBand store={storefront} id="in-season" />
      <Visit store={storefront} id="visit" art={{engine: 'alive', ground: 'cream-400', mark: TiungCat}} />
      <BagBar store={storefront} idle={heroIdle(storefront)} />
      <DishSheet store={storefront} />
    </Page>
  );
}
