export type AppLanguage = 'es' | 'en';

export const ES_TRANSLATIONS = {
  // App & Brand
  'app.name': 'Maquinarias y Propiedad',
  'app.tagline': 'Gestión agrícola',

  // Navigation & Views
  'nav.home': 'Inicio',
  'nav.homeSubtitle': 'Accesos principales',
  'nav.machinery': 'Maquinarias',
  'nav.machinerySubtitle': 'Movimientos de trabajos y equipos',
  'nav.property': 'Propiedad',
  'nav.propertySubtitle': 'Movimientos, lotes y cosechas',
  'nav.admin': 'Administración',
  'nav.adminSubtitle': 'Configuración y reportes',
  'nav.mainAria': 'Navegación principal',

  // Navbar & Account
  'navbar.refreshTitle': 'Actualizar datos desde Google Sheets',
  'navbar.currencyTitle': 'Cambiar moneda (USD / Bs)',
  'navbar.accountMenu': 'Menú de cuenta',
  'navbar.adminAuthorized': 'Administrador autorizado',
  'navbar.adminDeviceNote': 'Este dispositivo tiene acceso a Administración.',
  'navbar.userActive': 'Usuario activo',
  'navbar.revokeAdmin': 'Revocar autorización admin',
  'navbar.logout': 'Cerrar sesión',
  'navbar.revokeConfirmTitle': '¿Revocar autorización de administrador?',
  'navbar.revokeConfirmBody': 'Se revocará la autorización de este dispositivo para el módulo de Administración. Deberás ingresar la contraseña de administrador nuevamente si deseas volver a entrar.',
  'navbar.revokeConfirmBtn': 'Sí, revocar',
  'navbar.revoking': 'Revocando...',
  'navbar.logoutConfirmTitle': '¿Cerrar sesión?',
  'navbar.logoutConfirmBody': 'Se cerrará tu sesión actual en este dispositivo y tendrás que ingresar la contraseña nuevamente.',
  'navbar.logoutConfirmBtn': 'Cerrar sesión',

  // Sync / Global errors
  'sync.errorUpdating': 'No se pudo actualizar ({error}). Mostrando los últimos datos cargados.',
  'sync.defaultError': 'Error al sincronizar con Google Sheets',
  'sync.retry': 'Reintentar',

  // Common Actions & Labels
  'common.back': 'Volver',
  'common.cancel': 'Cancelar',
  'common.close': 'Cerrar',
  'common.save': 'Guardar',
  'common.saving': 'Guardando...',
  'common.saveChanges': 'Guardar cambios',
  'common.edit': 'Editar',
  'common.delete': 'Eliminar',
  'common.deleting': 'Eliminando...',
  'common.confirm': 'Confirmar',
  'common.confirmDelete': 'Sí, eliminar',
  'common.search': 'Buscar',
  'common.searchPlaceholder': 'Buscar...',
  'common.clearSearch': 'Limpiar búsqueda',
  'common.closeSearch': 'Cerrar búsqueda',
  'common.filters': 'Filtros',
  'common.all': 'Todos',
  'common.allFem': 'Todas',
  'common.none': 'Ninguno',
  'common.optional': '(opcional)',
  'common.required': 'Obligatorio',
  'common.date': 'Fecha',
  'common.campaign': 'Campaña',
  'common.currency': 'Moneda',
  'common.exchangeRate': 'Tipo de cambio (Bs/USD)',
  'common.exchangeRateShort': 'TC',
  'common.amount': 'Importe',
  'common.total': 'Total',
  'common.quantity': 'Cantidad',
  'common.unit': 'Unidad',
  'common.unitPrice': 'Precio unitario',
  'common.observation': 'Observación',
  'common.observations': 'Observaciones',
  'common.status': 'Estado',
  'common.type': 'Tipo',
  'common.detail': 'Detalle',
  'common.concept': 'Concepto',
  'common.category': 'Categoría',
  'common.lot': 'Lote',
  'common.lots': 'Lotes',
  'common.machine': 'Máquina',
  'common.machines': 'Máquinas',
  'common.implement': 'Implemento',
  'common.implements': 'Implementos',
  'common.client': 'Cliente',
  'common.product': 'Producto',
  'common.tons': 'Toneladas',
  'common.hectares': 'Hectáreas',
  'common.hours': 'Horas',
  'common.active': 'Activo',
  'common.inactive': 'Inactivo',
  'common.activeFem': 'Activa',
  'common.closedFem': 'Cerrada',
  'common.loading': 'Cargando...',
  'common.updating': 'Actualizando...',
  'common.noRecords': 'No hay registros para mostrar.',
  'common.noResults': 'No se encontraron resultados.',
  'common.selectOption': 'Seleccionar',
  'common.selectCurrency': 'Moneda',
  'common.usd': 'USD ($)',
  'common.bob': 'Bs (BOB)',
  'common.print': 'Imprimir',
  'common.exportExcel': 'Exportar Excel',
  'common.exporting': 'Exportando...',
  'common.yes': 'Sí',
  'common.no': 'No',
  'common.new': 'Nuevo',
  'common.add': 'Agregar',
  'common.apply': 'Aplicar',
  'common.clear': 'Limpiar',
  'common.view': 'Ver',
  'common.records': 'registros',
  'common.record': 'registro',
  'common.today': 'Hoy',
  'common.unassigned': 'Sin asignar',
  'common.noDate': 'Sin fecha',
  'common.noCampaign': 'Sin campaña',
  'common.general': 'General',
  'common.errorGeneric': 'Ocurrió un error. Intenta nuevamente.',
  'common.tcInvalidConvert': 'Ingresa un tipo de cambio válido mayor a 0 para convertir el importe.',

  // Login View
  'login.passwordLabel': 'Contraseña',
  'login.passwordPlaceholder': 'Ingrese contraseña',
  'login.showPassword': 'Ver contraseña',
  'login.hidePassword': 'Ocultar contraseña',
  'login.submit': 'Ingresar',
  'login.submitting': 'Ingresando...',
  'login.emptyPassword': 'Por favor ingresa la contraseña.',
  'login.defaultError': 'No se pudo completar el inicio de sesión. Intenta nuevamente.',
  'login.error.auth': 'Error de acceso',
  'login.error.network': 'Error de conexión',
  'login.error.server': 'Error del servidor',
  'login.error.invalid_response': 'Respuesta inválida del servidor',
  'login.error.unknown': 'Error al iniciar sesión',

  // Dashboard View
  'dashboard.noCampaignTitle': 'Sin campaña activa',
  'dashboard.noCampaignDesc': 'Configura una campaña en Administración para comenzar a registrar.',
  'dashboard.machineryTitle': 'Maquinarias',
  'dashboard.machineryDesc': 'Servicios, gastos, cobros e historial',
  'dashboard.propertyTitle': 'Propiedad',
  'dashboard.propertyDesc': 'Ventas, cosechas, gastos y lotes',

  // Language Settings
  'language.title': 'Idioma',
  'language.subtitle': 'Selecciona el idioma de la aplicación',
  'language.spanish': 'Español',
  'language.english': 'English',
  'language.selected': 'Seleccionado',
  'language.activeNote': 'El cambio se aplica al instante sin recargar la aplicación.',
  'language.accessHint': 'Cambiar idioma de la interfaz',

  // Voice Dictation / ObservationField
  'voice.typeBtn': 'Escribir',
  'voice.dictateBtn': 'Dictar',
  'voice.continueBtn': 'Continuar dictando',
  'voice.stopBtn': 'Detener',
  'voice.listening': 'Escuchando...',
  'voice.privacyNote': 'El dictado usa el reconocimiento del navegador o dispositivo. Solo se guarda el texto final.',
  'voice.unsupported': 'El dictado directo no está disponible en este navegador. Usa el micrófono del teclado de tu dispositivo.',
  'voice.permissionDenied': 'Permiso de micrófono denegado. Habilítalo en tu navegador o usa el micrófono del teclado.',
  'voice.noSpeech': 'No se detectó voz. Intenta hablar más cerca del micrófono.',
  'voice.audioCapture': 'No se pudo acceder al micrófono. Verifica que no esté en uso por otra aplicación.',
  'voice.networkError': 'Error de red en el reconocimiento de voz. Puedes usar el micrófono del teclado del dispositivo.',
  'voice.startError': 'No se pudo iniciar el dictado. Puedes escribir o usar el micrófono del teclado.',
  'voice.placeholderDefault': 'Agregar una observación...',

  // Visual Entity Pickers & Icon Bottom Sheet
  'picker.searchPlaceholder': 'Buscar...',
  'picker.noMatches': 'Sin coincidencias',
  'picker.machineLabel': 'Máquina',
  'picker.machinePlaceholder': 'Seleccionar máquina',
  'picker.machineSearch': 'Buscar máquina...',
  'picker.machineEmpty': 'No hay máquinas disponibles',
  'picker.machineAll': 'Todas las máquinas',
  'picker.implementLabel': 'Implemento / Labor',
  'picker.implementPlaceholder': 'Seleccionar implemento',
  'picker.implementSearch': 'Buscar implemento o labor...',
  'picker.implementEmpty': 'No hay implementos disponibles',
  'picker.implementNone': 'Sin implemento / Ninguno',
  'picker.expenseLabel': 'Concepto de gasto',
  'picker.expensePlaceholder': 'Seleccionar concepto',
  'picker.expenseSearch': 'Buscar concepto de gasto...',
  'picker.expenseEmpty': 'No hay conceptos de gasto disponibles',
  'picker.incomeLabel': 'Producto / Concepto',
  'picker.incomePlaceholder': 'Seleccionar producto / cosecha',
  'picker.incomeSearch': 'Buscar producto o ingreso...',
  'picker.incomeEmpty': 'No hay productos disponibles',
  'picker.lotLabel': 'Lote',
  'picker.lotPlaceholder': 'Seleccionar lote',
  'picker.lotSearch': 'Buscar lote...',
  'picker.lotEmpty': 'No hay lotes disponibles',
  'picker.lotNone': 'Ninguno / General',
  'picker.lotAll': 'Todos los lotes',
  'picker.countSingular': 'opción',
  'picker.countPlural': 'opciones',
  'iconSheet.title': 'Elegir icono',
  'iconSheet.searchPlaceholder': 'Buscar icono...',
  'iconSheet.all': 'Todos',
  'iconSheet.machinery': 'Maquinaria',
  'iconSheet.implements': 'Implementos',
  'iconSheet.expenses': 'Gastos',
  'iconSheet.incomes': 'Ingresos',
  'iconSheet.empty': 'No se encontraron iconos para tu búsqueda.',

  // PWA Install & Update
  'pwa.installTitle': 'Instalar aplicación',
  'pwa.installBtn': 'Instalar app',
  'pwa.iosHint': 'Para instalar en iPhone/iPad: toca Compartir y luego "Agregar a pantalla de inicio".',
  'pwa.updateTitle': 'Nueva versión disponible',
  'pwa.updateBtn': 'Actualizar',

  // Apps Script Modal
  'appsScript.title': 'Código Google Apps Script',
  'appsScript.subtitle': 'Backend conectado a Google Sheets',
  'appsScript.copy': 'Copiar código',
  'appsScript.copied': 'Copiado',

  // Admin Menu & Auth Gate
  'admin.authTitle': 'Acceso a Administración',
  'admin.authSubtitle': 'Ingresa la contraseña de administrador para gestionar catálogos, reportes y usuarios.',
  'admin.authPasswordLabel': 'Contraseña de administrador',
  'admin.authPasswordPlaceholder': 'Ingrese contraseña de administrador',
  'admin.authSubmit': 'Autorizar acceso',
  'admin.authSubmitting': 'Verificando...',
  'admin.authEmptyError': 'Por favor ingresa la contraseña de administrador.',
  'admin.authDefaultError': 'Contraseña de administrador incorrecta.',
  'admin.menu.machines': 'Máquinas e implementos',
  'admin.menu.machinesSub': 'Equipos, implementos y labores',
  'admin.menu.lots': 'Lotes',
  'admin.menu.lotsSub': 'Superficies, cultivos y ubicación',
  'admin.menu.concepts': 'Conceptos',
  'admin.menu.conceptsSub': 'Rubros de ingresos y gastos',
  'admin.menu.fx': 'Tipo de cambio',
  'admin.menu.fxSub': 'Tasa oficial BCB o manual',
  'admin.menu.campaigns': 'Campañas',
  'admin.menu.campaignsSub': 'Ciclos agrícolas activos e históricos',
  'admin.menu.reports': 'Finanzas',
  'admin.menu.reportsSub': 'Consolidado, Maquinarias y Propiedad',
  'admin.menu.assets': 'Patrimonio',
  'admin.menu.assetsSub': 'Activos, mejoras y valuación',
  'admin.menu.receivables': 'Cuentas por cobrar',
  'admin.menu.receivablesSub': 'Saldos por cliente, intereses y cobros',
  'admin.menu.customers': 'Clientes',
  'admin.menu.customersSub': 'Catálogo de clientes y compradores',
  'admin.menu.paymentSettings': 'Configuración de cobros',
  'admin.menu.paymentSettingsSub': 'Plazos de pago e interés por mora',
  'admin.menu.users': 'Usuarios',
  'admin.menu.usersSub': 'Contraseñas de usuario y administrador',
  'admin.menu.language': 'Idioma',
  'admin.menu.languageSub': 'Español / English',
  'admin.languageTitle': 'Idioma',

  // Machinery Module
  'machinery.menu.service': 'Registrar servicio',
  'machinery.menu.serviceSub': 'Trabajo propio o a terceros',
  'machinery.menu.expense': 'Registrar gasto',
  'machinery.menu.expenseSub': 'Combustible, repuestos y mantenimiento',
  'machinery.menu.receivables': 'Por cobrar',
  'machinery.menu.receivablesSub': 'Servicios a terceros y cobros',
  'machinery.menu.history': 'Historial',
  'machinery.menu.historySub': 'Servicios y gastos registrados',
  'machinery.menu.equipment': 'Equipos',
  'machinery.menu.equipmentSub': 'Máquinas e implementos registrados',

  // Property Module
  'property.menu.sale': 'Venta / Cosecha',
  'property.menu.saleSub': 'Venta directa o cosecha sin precio',
  'property.menu.pending': 'Ventas de cosecha',
  'property.menu.pendingSub': 'Ventas parciales o totales y compradores',
  'property.menu.expense': 'Registrar gasto',
  'property.menu.expenseSub': 'Insumos, semillas y gastos de lotes',
  'property.menu.lots': 'Mis lotes',
  'property.menu.lotsSub': 'Trabajos, cosechas y gastos por lote',
  'property.menu.jobs': 'Trabajos de maquinaria',
  'property.menu.jobsSub': 'Labores realizadas en la propiedad',
  'property.menu.history': 'Historial',
  'property.menu.historySub': 'Ingresos, cosechas y gastos',

  // Reports / Finances Module
  'reports.title': 'Finanzas',
  'reports.tab.consolidated': 'General',
  'reports.tab.machinery': 'Maquinarias',
  'reports.tab.property': 'Propiedad',
  'reports.incomes': 'Ingresos',
  'reports.interestIncomes': 'Ingresos por intereses',
  'reports.expenses': 'Gastos',
  'reports.netResult': 'Resultado neto',
  'reports.receivable': 'Por cobrar',
  'reports.collected': 'Cobrado',
  'reports.pending': 'Pendiente',
  'reports.harvestsNoPrice': 'Cosechas sin precio',
  'reports.totalTons': 'Toneladas totales',
  'reports.margin': 'Margen',
  'reports.period': 'Período',
  'reports.from': 'Desde',
  'reports.to': 'Hasta',
  'reports.generatedAt': 'Generado el',

  // Customers, Harvest Sales, AR & Documents
  'customers.title': 'Clientes',
  'customers.newTitle': 'Nuevo cliente',
  'customers.editTitle': 'Editar cliente',
  'customers.name': 'Nombre',
  'customers.phone': 'Teléfono',
  'customers.address': 'Dirección',
  'customers.pendingClient': 'Cliente pendiente',
  'customers.pendingBuyer': 'Comprador pendiente',
  'customers.selectClient': 'Seleccionar cliente',
  'customers.selectCustomer': 'Seleccionar cliente',
  'customers.selectBuyer': 'Seleccionar comprador',
  'harvestSales.title': 'Ventas de cosecha',
  'harvestSales.newSale': 'Nueva venta de cosecha',
  'harvestSales.editSale': 'Editar venta de cosecha',
  'harvestSales.pendingBuyer': 'Comprador pendiente',
  'harvestSales.pendingPrice': 'Precio pendiente',
  'harvestSales.status.bothPending': 'Comprador y precio pendientes',
  'harvestSales.status.buyerPending': 'Comprador pendiente',
  'harvestSales.status.pricePending': 'Precio pendiente',
  'harvestSales.status.complete': 'Venta completa',
  'harvestSales.statusBothPending': 'Comprador y precio pendientes',
  'harvestSales.statusBuyerPending': 'Comprador pendiente',
  'harvestSales.statusPricePending': 'Precio pendiente',
  'harvestSales.statusComplete': 'Venta completa',
  'paymentSettings.title': 'Configuración de cobros',
  'paymentSettings.defaultTermDays': 'Plazo de pago predeterminado (días)',
  'paymentSettings.applyInterestDefault': 'Aplicar interés por mora por defecto',
  'paymentSettings.monthlyInterestPercent': 'Porcentaje de interés mensual (%)',
  'finances.lateInterestConcept': 'Interés por mora',
  'finances.serviceIncome': 'Ingresos por servicios',
  'finances.harvestIncome': 'Ingresos por ventas de cosecha',
  'finances.interestIncome': 'Ingresos por interés por mora cobrado',
  'ar.title': 'Cuentas por cobrar',
  'ar.debitNote': 'NOTA DE DÉBITO',
  'ar.paymentReceipt': 'NOTA DE COBRO',
  'ar.nonFiscalNotice': 'Documento administrativo interno · No válido como factura fiscal',
} as const;

export type TranslationKey = keyof typeof ES_TRANSLATIONS;

export const EN_TRANSLATIONS: Record<TranslationKey, string> = {
  // App & Brand
  'app.name': 'Machinery & Property',
  'app.tagline': 'Farm management',

  // Navigation & Views
  'nav.home': 'Home',
  'nav.homeSubtitle': 'Quick access',
  'nav.machinery': 'Machinery',
  'nav.machinerySubtitle': 'Equipment jobs and expenses',
  'nav.property': 'Property',
  'nav.propertySubtitle': 'Movements, lots and harvests',
  'nav.admin': 'Administration',
  'nav.adminSubtitle': 'Settings and reports',
  'nav.mainAria': 'Main navigation',

  // Navbar & Account
  'navbar.refreshTitle': 'Refresh data from Google Sheets',
  'navbar.currencyTitle': 'Switch currency (USD / Bs)',
  'navbar.accountMenu': 'Account menu',
  'navbar.adminAuthorized': 'Authorized administrator',
  'navbar.adminDeviceNote': 'This device has access to Administration.',
  'navbar.userActive': 'Active user',
  'navbar.revokeAdmin': 'Revoke admin authorization',
  'navbar.logout': 'Sign out',
  'navbar.revokeConfirmTitle': 'Revoke administrator authorization?',
  'navbar.revokeConfirmBody': 'Administrator authorization for this device will be revoked. You will need to enter the administrator password again to access Administration.',
  'navbar.revokeConfirmBtn': 'Yes, revoke',
  'navbar.revoking': 'Revoking...',
  'navbar.logoutConfirmTitle': 'Sign out?',
  'navbar.logoutConfirmBody': 'Your current session on this device will be closed and you will need to enter the password again.',
  'navbar.logoutConfirmBtn': 'Sign out',

  // Sync / Global errors
  'sync.errorUpdating': 'Could not update ({error}). Showing the latest loaded data.',
  'sync.defaultError': 'Error syncing with Google Sheets',
  'sync.retry': 'Retry',

  // Common Actions & Labels
  'common.back': 'Back',
  'common.cancel': 'Cancel',
  'common.close': 'Close',
  'common.save': 'Save',
  'common.saving': 'Saving...',
  'common.saveChanges': 'Save changes',
  'common.edit': 'Edit',
  'common.delete': 'Delete',
  'common.deleting': 'Deleting...',
  'common.confirm': 'Confirm',
  'common.confirmDelete': 'Yes, delete',
  'common.search': 'Search',
  'common.searchPlaceholder': 'Search...',
  'common.clearSearch': 'Clear search',
  'common.closeSearch': 'Close search',
  'common.filters': 'Filters',
  'common.all': 'All',
  'common.allFem': 'All',
  'common.none': 'None',
  'common.optional': '(optional)',
  'common.required': 'Required',
  'common.date': 'Date',
  'common.campaign': 'Campaign',
  'common.currency': 'Currency',
  'common.exchangeRate': 'Exchange rate (Bs/USD)',
  'common.exchangeRateShort': 'FX',
  'common.amount': 'Amount',
  'common.total': 'Total',
  'common.quantity': 'Quantity',
  'common.unit': 'Unit',
  'common.unitPrice': 'Unit price',
  'common.observation': 'Observation',
  'common.observations': 'Observations',
  'common.status': 'Status',
  'common.type': 'Type',
  'common.detail': 'Detail',
  'common.concept': 'Concept',
  'common.category': 'Category',
  'common.lot': 'Lot',
  'common.lots': 'Lots',
  'common.machine': 'Machine',
  'common.machines': 'Machines',
  'common.implement': 'Implement',
  'common.implements': 'Implements',
  'common.client': 'Client',
  'common.product': 'Product',
  'common.tons': 'Tons',
  'common.hectares': 'Hectares',
  'common.hours': 'Hours',
  'common.active': 'Active',
  'common.inactive': 'Inactive',
  'common.activeFem': 'Active',
  'common.closedFem': 'Closed',
  'common.loading': 'Loading...',
  'common.updating': 'Updating...',
  'common.noRecords': 'No records to display.',
  'common.noResults': 'No results found.',
  'common.selectOption': 'Select',
  'common.selectCurrency': 'Currency',
  'common.usd': 'USD ($)',
  'common.bob': 'Bs (BOB)',
  'common.print': 'Print',
  'common.exportExcel': 'Export Excel',
  'common.exporting': 'Exporting...',
  'common.yes': 'Yes',
  'common.no': 'No',
  'common.new': 'New',
  'common.add': 'Add',
  'common.apply': 'Apply',
  'common.clear': 'Clear',
  'common.view': 'View',
  'common.records': 'records',
  'common.record': 'record',
  'common.today': 'Today',
  'common.unassigned': 'Unassigned',
  'common.noDate': 'No date',
  'common.noCampaign': 'No campaign',
  'common.general': 'General',
  'common.errorGeneric': 'An error occurred. Please try again.',
  'common.tcInvalidConvert': 'Enter a valid exchange rate greater than 0 to convert the amount.',

  // Login View
  'login.passwordLabel': 'Password',
  'login.passwordPlaceholder': 'Enter password',
  'login.showPassword': 'Show password',
  'login.hidePassword': 'Hide password',
  'login.submit': 'Sign in',
  'login.submitting': 'Signing in...',
  'login.emptyPassword': 'Please enter the password.',
  'login.defaultError': 'Could not complete sign in. Please try again.',
  'login.error.auth': 'Access error',
  'login.error.network': 'Connection error',
  'login.error.server': 'Server error',
  'login.error.invalid_response': 'Invalid server response',
  'login.error.unknown': 'Sign in error',

  // Dashboard View
  'dashboard.noCampaignTitle': 'No active campaign',
  'dashboard.noCampaignDesc': 'Configure a campaign in Administration to start recording.',
  'dashboard.machineryTitle': 'Machinery',
  'dashboard.machineryDesc': 'Services, expenses, collections & history',
  'dashboard.propertyTitle': 'Property',
  'dashboard.propertyDesc': 'Sales, harvests, expenses & lots',

  // Language Settings
  'language.title': 'Language',
  'language.subtitle': 'Select the application language',
  'language.spanish': 'Español',
  'language.english': 'English',
  'language.selected': 'Selected',
  'language.activeNote': 'Changes apply immediately without reloading the app.',
  'language.accessHint': 'Change interface language',

  // Voice Dictation / ObservationField
  'voice.typeBtn': 'Type',
  'voice.dictateBtn': 'Dictate',
  'voice.continueBtn': 'Continue dictating',
  'voice.stopBtn': 'Stop',
  'voice.listening': 'Listening...',
  'voice.privacyNote': 'Voice dictation uses your browser or device speech recognition service. Only the final text is saved.',
  'voice.unsupported': 'Direct voice dictation is not available in this browser. Use the microphone on your device keyboard.',
  'voice.permissionDenied': 'Microphone permission denied. Enable it in your browser or use your keyboard microphone.',
  'voice.noSpeech': 'No speech detected. Try speaking closer to the microphone.',
  'voice.audioCapture': 'Could not access the microphone. Check that it is not being used by another app.',
  'voice.networkError': 'Voice recognition network error. You can use the microphone on your device keyboard.',
  'voice.startError': 'Could not start dictation. You can type or use your device keyboard microphone.',
  'voice.placeholderDefault': 'Add an observation...',

  // Visual Entity Pickers & Icon Bottom Sheet
  'picker.searchPlaceholder': 'Search...',
  'picker.noMatches': 'No matches',
  'picker.machineLabel': 'Machine',
  'picker.machinePlaceholder': 'Select machine',
  'picker.machineSearch': 'Search machine...',
  'picker.machineEmpty': 'No machines available',
  'picker.machineAll': 'All machines',
  'picker.implementLabel': 'Implement / Task',
  'picker.implementPlaceholder': 'Select implement',
  'picker.implementSearch': 'Search implement or task...',
  'picker.implementEmpty': 'No implements available',
  'picker.implementNone': 'No implement / None',
  'picker.expenseLabel': 'Expense concept',
  'picker.expensePlaceholder': 'Select concept',
  'picker.expenseSearch': 'Search expense concept...',
  'picker.expenseEmpty': 'No expense concepts available',
  'picker.incomeLabel': 'Product / Concept',
  'picker.incomePlaceholder': 'Select product / harvest',
  'picker.incomeSearch': 'Search product or income...',
  'picker.incomeEmpty': 'No products available',
  'picker.lotLabel': 'Lot',
  'picker.lotPlaceholder': 'Select lot',
  'picker.lotSearch': 'Search lot...',
  'picker.lotEmpty': 'No lots available',
  'picker.lotNone': 'None / General',
  'picker.lotAll': 'All lots',
  'picker.countSingular': 'option',
  'picker.countPlural': 'options',
  'iconSheet.title': 'Choose icon',
  'iconSheet.searchPlaceholder': 'Search icon...',
  'iconSheet.all': 'All',
  'iconSheet.machinery': 'Machinery',
  'iconSheet.implements': 'Implements',
  'iconSheet.expenses': 'Expenses',
  'iconSheet.incomes': 'Income',
  'iconSheet.empty': 'No icons found for your search.',

  // PWA Install & Update
  'pwa.installTitle': 'Install app',
  'pwa.installBtn': 'Install app',
  'pwa.iosHint': 'To install on iPhone/iPad: tap Share and then "Add to Home Screen".',
  'pwa.updateTitle': 'New version available',
  'pwa.updateBtn': 'Update',

  // Apps Script Modal
  'appsScript.title': 'Google Apps Script Code',
  'appsScript.subtitle': 'Backend connected to Google Sheets',
  'appsScript.copy': 'Copy code',
  'appsScript.copied': 'Copied',

  // Admin Menu & Auth Gate
  'admin.authTitle': 'Administration Access',
  'admin.authSubtitle': 'Enter the administrator password to manage catalogs, reports, and users.',
  'admin.authPasswordLabel': 'Administrator password',
  'admin.authPasswordPlaceholder': 'Enter administrator password',
  'admin.authSubmit': 'Authorize access',
  'admin.authSubmitting': 'Verifying...',
  'admin.authEmptyError': 'Please enter the administrator password.',
  'admin.authDefaultError': 'Incorrect administrator password.',
  'admin.menu.machines': 'Machines & implements',
  'admin.menu.machinesSub': 'Equipment, implements & tasks',
  'admin.menu.lots': 'Lots',
  'admin.menu.lotsSub': 'Surface areas, crops & location',
  'admin.menu.concepts': 'Concepts',
  'admin.menu.conceptsSub': 'Income & expense categories',
  'admin.menu.fx': 'Exchange rate',
  'admin.menu.fxSub': 'Official BCB or manual rate',
  'admin.menu.campaigns': 'Campaigns',
  'admin.menu.campaignsSub': 'Active & historical farm seasons',
  'admin.menu.reports': 'Finances',
  'admin.menu.reportsSub': 'Consolidated, Machinery & Property',
  'admin.menu.assets': 'Assets',
  'admin.menu.assetsSub': 'Property, improvements & valuation',
  'admin.menu.receivables': 'Accounts Receivable',
  'admin.menu.receivablesSub': 'Balances by customer, interest & collections',
  'admin.menu.customers': 'Customers',
  'admin.menu.customersSub': 'Customer and buyer directory',
  'admin.menu.paymentSettings': 'Payment Settings',
  'admin.menu.paymentSettingsSub': 'Payment terms & late-payment interest',
  'admin.menu.users': 'Users',
  'admin.menu.usersSub': 'User & administrator passwords',
  'admin.menu.language': 'Language',
  'admin.menu.languageSub': 'Español / English',
  'admin.languageTitle': 'Language',

  // Machinery Module
  'machinery.menu.service': 'Record service',
  'machinery.menu.serviceSub': 'Own property or third-party work',
  'machinery.menu.expense': 'Record expense',
  'machinery.menu.expenseSub': 'Fuel, spare parts & maintenance',
  'machinery.menu.receivables': 'Receivables',
  'machinery.menu.receivablesSub': 'Third-party services & collections',
  'machinery.menu.history': 'History',
  'machinery.menu.historySub': 'Recorded services & expenses',
  'machinery.menu.equipment': 'Equipment',
  'machinery.menu.equipmentSub': 'Registered machines & implements',

  // Property Module
  'property.menu.sale': 'Sale / Harvest',
  'property.menu.saleSub': 'Direct sale or unpriced harvest',
  'property.menu.pending': 'Harvest Sales',
  'property.menu.pendingSub': 'Partial or full harvest sales & buyers',
  'property.menu.expense': 'Record expense',
  'property.menu.expenseSub': 'Inputs, seeds & lot expenses',
  'property.menu.lots': 'My lots',
  'property.menu.lotsSub': 'Jobs, harvests & expenses by lot',
  'property.menu.jobs': 'Machinery jobs',
  'property.menu.jobsSub': 'Work performed on property lots',
  'property.menu.history': 'History',
  'property.menu.historySub': 'Income, harvests & expenses',

  // Reports / Finances Module
  'reports.title': 'Finances',
  'reports.tab.consolidated': 'General',
  'reports.tab.machinery': 'Machinery',
  'reports.tab.property': 'Property',
  'reports.incomes': 'Income',
  'reports.interestIncomes': 'Interest income',
  'reports.expenses': 'Expenses',
  'reports.netResult': 'Net result',
  'reports.receivable': 'Receivable',
  'reports.collected': 'Collected',
  'reports.pending': 'Pending',
  'reports.harvestsNoPrice': 'Unpriced harvests',
  'reports.totalTons': 'Total tons',
  'reports.margin': 'Margin',
  'reports.period': 'Period',
  'reports.from': 'From',
  'reports.to': 'To',
  'reports.generatedAt': 'Generated on',

  // Customers, Harvest Sales, AR & Documents
  'customers.title': 'Customers',
  'customers.newTitle': 'New customer',
  'customers.editTitle': 'Edit customer',
  'customers.name': 'Name',
  'customers.phone': 'Phone',
  'customers.address': 'Address',
  'customers.pendingClient': 'Pending customer',
  'customers.pendingBuyer': 'Pending buyer',
  'customers.selectClient': 'Select customer',
  'customers.selectCustomer': 'Select customer',
  'customers.selectBuyer': 'Select buyer',
  'harvestSales.title': 'Harvest Sales',
  'harvestSales.newSale': 'New harvest sale',
  'harvestSales.editSale': 'Edit harvest sale',
  'harvestSales.pendingBuyer': 'Pending buyer',
  'harvestSales.pendingPrice': 'Pending price',
  'harvestSales.status.bothPending': 'Buyer & price pending',
  'harvestSales.status.buyerPending': 'Buyer pending',
  'harvestSales.status.pricePending': 'Price pending',
  'harvestSales.status.complete': 'Complete sale',
  'harvestSales.statusBothPending': 'Buyer & price pending',
  'harvestSales.statusBuyerPending': 'Buyer pending',
  'harvestSales.statusPricePending': 'Price pending',
  'harvestSales.statusComplete': 'Complete sale',
  'paymentSettings.title': 'Payment Settings',
  'paymentSettings.defaultTermDays': 'Default payment term (days)',
  'paymentSettings.applyInterestDefault': 'Apply late interest by default',
  'paymentSettings.monthlyInterestPercent': 'Monthly interest rate (%)',
  'finances.lateInterestConcept': 'Late Payment Interest',
  'finances.serviceIncome': 'Service income',
  'finances.harvestIncome': 'Harvest sales income',
  'finances.interestIncome': 'Collected late-payment interest income',
  'ar.title': 'Accounts Receivable',
  'ar.debitNote': 'DEBIT NOTE',
  'ar.paymentReceipt': 'PAYMENT RECEIPT',
  'ar.nonFiscalNotice': 'Internal administrative document · Not valid as a tax invoice',
};

export const TRANSLATIONS: Record<AppLanguage, Record<TranslationKey, string>> = {
  es: ES_TRANSLATIONS,
  en: EN_TRANSLATIONS,
};

/**
 * Icon catalog labels in English (never modifies stored catalog names or IDs).
 */
export const ICON_LABELS_EN: Record<string, string> = {
  soya: 'Soybean',
  maiz: 'Corn',
  trigo: 'Wheat',
  sorgo: 'Sorghum',
  girasol: 'Sunflower',
  granos: 'Other Grains',
  'otros-ingresos': 'Other Income',
  tractor: 'Farm Tractor',
  'tractor-blue': 'Blue Tractor',
  cosechadora: 'Combine Harvester',
  camion: 'Cargo Truck',
  cargadora: 'Wheel Loader',
  excavadora: 'Excavator',
  motoniveladora: 'Motor Grader',
  pulverizadora: 'Self-Propelled Sprayer',
  'drone-agricola': 'Agricultural drone',
  'otros-equipos': 'Other Equipment',
  sembradora: 'Planter / Seeder',
  romplow: 'Heavy Disk Plow (Romplow)',
  ripper: 'Ripper / Subsoiler',
  'pala-niveladora': 'Land Leveler',
  rastra: 'Disk Harrow',
  trailla: 'Scraper',
  'cortadora-sorgo': 'Sorghum Mower',
  rolo: 'Knife Roller',
  fumigadora: 'Trailed Sprayer',
  cultivador: 'Cultivator',
  'otros-implementos': 'Other Implements',
  diesel: 'Diesel',
  gasolina: 'Gasoline',
  aceite: 'Motor Oil',
  filtro: 'Filters',
  neumaticos: 'Tires',
  bateria: 'Battery',
  repuestos: 'Spare Parts',
  mantenimiento: 'Maintenance / Workshop',
  grasa: 'Greases & Lubricants',
  semillas: 'Seeds',
  fertilizante: 'Fertilizers',
  herbicida: 'Herbicides',
  insecticida: 'Insecticides',
  'otros-gastos': 'Other Expenses',
};

export function translateIconLabel(
  iconId: string,
  fallbackEs: string | undefined | null,
  lang: AppLanguage
): string {
  const fallback = fallbackEs || '';
  if (lang === 'es') return fallback;
  return ICON_LABELS_EN[iconId] || fallback;
}

/**
 * Translates standard measurement units for UI display only.
 * Never modifies values stored in Google Sheets.
 */
export function translateUnit(unit: string | undefined | null, lang: AppLanguage): string {
  const raw = String(unit || '').trim();
  if (!raw || lang === 'es') return raw;

  const norm = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const map: Record<string, string> = {
    hora: 'hour',
    horas: 'hours',
    hr: 'hr',
    hrs: 'hrs',
    hectarea: 'hectare',
    hectareas: 'hectares',
    ha: 'ha',
    has: 'ha',
    tonelada: 'ton',
    toneladas: 'tons',
    tn: 't',
    t: 't',
    kilogramo: 'kilogram',
    kilogramos: 'kilograms',
    kilo: 'kg',
    kilos: 'kg',
    kg: 'kg',
    litro: 'liter',
    litros: 'liters',
    lt: 'L',
    lts: 'L',
    l: 'L',
    bolsa: 'bag',
    bolsas: 'bags',
    quintal: 'quintal',
    quintales: 'quintals',
    qq: 'qq',
    unidad: 'unit',
    unidades: 'units',
    unid: 'unit',
    servicio: 'service',
    servicios: 'services',
    viaje: 'trip',
    viajes: 'trips',
    dia: 'day',
    dias: 'days',
    metro: 'meter',
    metros: 'meters',
    global: 'lump sum',
  };

  const translated = map[norm];
  if (!translated) return raw;
  // Preserve capitalization if original started with uppercase
  if (raw[0] === raw[0].toUpperCase() && raw[0] !== raw[0].toLowerCase()) {
    return translated.charAt(0).toUpperCase() + translated.slice(1);
  }
  return translated;
}

/**
 * Translates operational statuses for display without altering underlying status codes.
 */
export function translateStatus(status: string | undefined | null, lang: AppLanguage): string {
  const raw = String(status || '').trim();
  if (!raw || lang === 'es') return raw;

  const upper = raw.toUpperCase();
  const map: Record<string, string> = {
    PAGADO: 'PAID',
    PARCIAL: 'PARTIAL',
    PENDIENTE: 'PENDING',
    COBRADO: 'COLLECTED',
    SIN_PRECIO: 'UNPRICED',
    'SIN PRECIO': 'UNPRICED',
    ASIGNADO: 'ASSIGNED',
    COMPLETO: 'COMPLETED',
    ACTIVA: 'Active',
    CERRADA: 'Closed',
    ACTIVO: 'Active',
    INACTIVO: 'Inactive',
    OFICIAL: 'Official',
    MANUAL: 'Manual',
    COMPRADOR_Y_PRECIO_PENDIENTES: 'Buyer & price pending',
    COMPRADOR_PENDIENTE: 'Buyer pending',
    PRECIO_PENDIENTE: 'Price pending',
    VENTA_COMPLETA: 'Complete sale',
    VENCIDA: 'Overdue',
    TOTAL: 'Full',
  };
  return map[upper] || raw;
}

/**
 * Translates known Spanish backend / Apps Script / system error messages into English when English is active.
 */
export function translateBackendMessage(message: string | undefined | null, lang: AppLanguage): string {
  const raw = String(message || '').trim();
  if (!raw || lang === 'es') return raw;

  const lower = raw.toLowerCase();

  if (lower.includes('no se pudo conectar con el servidor')) {
    return 'Could not connect to the server. Check your internet connection and try again.';
  }
  if (lower.includes('se interrumpió la comunicación con el servidor')) {
    return 'Communication with the server was interrupted. Please try again.';
  }
  if (lower.includes('el servidor no respondió correctamente')) {
    const match = raw.match(/HTTP\s+\d+/i);
    return `The server did not respond properly${match ? ` (${match[0]})` : ''}. Please try again in a moment.`;
  }
  if (lower.includes('el servidor devolvió una respuesta inválida o vacía')) {
    return 'The server returned an invalid or empty response. Please try again.';
  }
  if (lower.includes('el servidor devolvió una respuesta inválida')) {
    return 'The server returned an invalid response. Please try again in a moment.';
  }
  if (lower.includes('error del servidor (http')) {
    const match = raw.match(/HTTP\s+\d+/i);
    return `Server error${match ? ` (${match[0]})` : ''}. Please try again in a moment.`;
  }
  if (lower.includes('contraseña incorrecta') || lower.includes('contrasena incorrecta')) {
    return 'Incorrect password.';
  }
  if (lower.includes('usuario o pin incorrecto') || lower.includes('pin incorrecto')) {
    return 'Incorrect username or PIN.';
  }
  if (lower.includes('credenciales incorrectas')) {
    return 'Incorrect credentials.';
  }
  if (lower.includes('ingrese la contraseña') || lower.includes('ingrese la contrasena')) {
    return 'Please enter the password.';
  }
  if (lower.includes('sesión vencida') || lower.includes('sesion vencida')) {
    return 'Your session has expired. Please sign in again.';
  }
  if (lower.includes('se requiere iniciar sesion') || lower.includes('se requiere iniciar sesión')) {
    return 'Sign in required.';
  }
  if (lower.includes('autorización administrativa') || lower.includes('autorizacion administrativa') || lower.includes('autorización de administrador')) {
    return 'Administrator authorization is required. Please authorize again.';
  }
  if (lower.includes('tipo de cambio no configurado')) {
    return 'Exchange rate is not configured in Google Sheets. Please configure the exchange rate in Administration → Exchange rate before recording transactions.';
  }
  if (lower.includes('ingresa un tipo de cambio válido mayor a 0')) {
    return 'Enter a valid exchange rate greater than 0 to convert the amount.';
  }
  if (lower.includes('error al sincronizar con google sheets')) {
    return 'Error syncing with Google Sheets.';
  }
  if (lower.includes('error al consultar')) {
    return 'Error fetching data from server. Please try again.';
  }
  if (lower.includes('no se pudo guardar')) {
    return 'Could not save the record. Please try again.';
  }
  if (lower.includes('no se pudo eliminar')) {
    return 'Could not delete the record. Please try again.';
  }
  if (lower.includes('no se pudo actualizar')) {
    return 'Could not update the record. Please try again.';
  }
  if (lower.includes('campaña activa') && lower.includes('no')) {
    return 'No active campaign found. Please activate a campaign in Administration.';
  }
  if (lower.includes('no se encontró el registro') || lower.includes('registro no encontrado')) {
    return 'Record not found.';
  }
  if (lower.includes('excede el saldo pendiente')) {
    return 'The entered amount exceeds the remaining balance.';
  }
  if (lower.includes('excede las toneladas pendientes')) {
    return 'The entered tons exceed the remaining unpriced tons.';
  }
  if (lower.includes('error en la acción')) {
    return raw.replace(/Error en la acción/i, 'Error running action');
  }

  return raw;
}
