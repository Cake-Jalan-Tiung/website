import {CrownedTiungReversed} from '../marks/marks.generated';
import {Stage, TypesetWordmark} from '../system/components';
import {Band, Columns, Stack} from '../system/layout';
import {Type} from '../system/Type';
import {signOff} from './content';

/** How every page ends: the sign-off on ink, under the crowned head. */
export function Closing() {
  return (
    <Band as="footer" ground="ink">
      <Columns count={2} align="center">
        <Stack gap="md">
          <Type role="display" as="p">
            {signOff}
          </Type>
          <TypesetWordmark role="label" />
        </Stack>
        <Stage engine="alive" ground="ink" height={340} padding={0} mark={CrownedTiungReversed} />
      </Columns>
    </Band>
  );
}
