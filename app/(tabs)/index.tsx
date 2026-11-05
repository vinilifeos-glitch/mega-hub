import { ServicesHome } from '../../src/screens/Services';
/** Events tab: everyone can view; create/edit lives under Admin. */
export default function EventsTab() {
  return <ServicesHome readOnly />;
}
