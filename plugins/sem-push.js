// O app só usa lembretes LOCAIS. O expo-notifications adiciona por padrão o recurso
// "Push Notifications" (aps-environment), que o Apple ID gratuito não consegue assinar.
// Este plugin remove esse recurso do projeto iOS para a instalação pelo Sideloadly funcionar.
const { withEntitlementsPlist } = require('expo/config-plugins');

module.exports = function semPush(config) {
  return withEntitlementsPlist(config, (c) => {
    delete c.modResults['aps-environment'];
    return c;
  });
};
