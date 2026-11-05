import { useState } from 'react';
import { Text, View } from 'react-native';
import { useMe } from '../../src/state/AppContext';
import { Button, Card, Empty, Screen, useStyles } from '../../src/components/ui';
import { ServicesHome } from '../../src/screens/Services';
import Accounts from './accounts';

export default function AdminTab() {
  const s = useStyles();
  const { canManageAccounts, t, isStaff } = useMe();
  const [panel, setPanel] = useState<'hub' | 'events' | 'accounts'>('hub');
  if (!isStaff) {
    return <Screen title={t('admin.title')}><Empty text={t('admin.staffOnly')} /></Screen>;
  }
  if (panel === 'events') {
    return (
      <View style={{ flex: 1 }} testID="admin-events-panel">
        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          <Button label={t('admin.back')} outline onPress={() => setPanel('hub')} testID="admin-back" />
        </View>
        <ServicesHome />
      </View>
    );
  }
  if (panel === 'accounts') {
    if (!canManageAccounts) {
      return (
        <Screen title={t('admin.accounts')}>
          <Empty text={t('errors.ownerOnlyAccounts')} />
          <Button label={t('admin.back')} outline onPress={() => setPanel('hub')} />
        </Screen>
      );
    }
    return (
      <View style={{ flex: 1 }} testID="admin-accounts-panel">
        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          <Button label={t('admin.back')} outline onPress={() => setPanel('hub')} testID="admin-back" />
        </View>
        <Accounts />
      </View>
    );
  }
  return (
    <Screen title={t('admin.title')} subtitle={t('admin.subtitle')}>
      <Card>
        <Text style={s.h2}>{t('admin.events')}</Text>
        <Text style={[s.small, { marginBottom: 12 }]}>{t('admin.eventsHint')}</Text>
        <Button label={t('admin.events')} onPress={() => setPanel('events')} testID="admin-events" />
      </Card>
      {canManageAccounts && (
        <Card>
          <Text style={s.h2}>{t('admin.accounts')}</Text>
          <Text style={[s.small, { marginBottom: 12 }]}>{t('admin.accountsHint')}</Text>
          <Button label={t('admin.accounts')} onPress={() => setPanel('accounts')} testID="admin-accounts" />
        </Card>
      )}
    </Screen>
  );
}
