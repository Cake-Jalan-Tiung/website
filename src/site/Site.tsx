import {BurungTiung, TiungCat} from '../marks/marks.generated';
import {Page} from '../system/layout';
import {CategoryTiles, DishGrid, Facts, Hero, Sections, SeasonBand, StoreFooter, StoreHeader, StoreSection, Visit} from '../storefront/sections';
import {dishesById} from '../storefront/model';
import {BagBar} from '../storefront/bag';
import {handDrawn, promise, storefront} from './content';

export function Site() {
  return (
    <Page top={<StoreHeader store={storefront} />} bottom={<StoreFooter store={storefront} />}>
      <Hero title={promise} lede={handDrawn} art={{engine: 'alive', ground: 'cream-100', mark: BurungTiung}} store={storefront} />
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
      <BagBar store={storefront} />
    </Page>
  );
}
