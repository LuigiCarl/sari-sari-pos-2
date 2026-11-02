const express = require('express');
const { requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/adminController');

const router = express.Router();
router.use(requireRole('admin'));

router.get('/dashboard', ctrl.dashboard);
router.get('/api/sales-chart', ctrl.salesChartData);

router.get('/products/export.csv', ctrl.exportProductsCsv);
router.get('/products', ctrl.listProducts);
router.post('/products', ctrl.createProduct);
router.post('/products/:id', ctrl.updateProduct);
router.post('/categories', ctrl.createCategory);

router.get('/users', ctrl.listUsers);
router.post('/users', ctrl.createUser);
router.post('/users/:id/toggle-active', ctrl.toggleUserActive);

router.get('/sales/export.csv', ctrl.exportSalesCsv);
router.get('/sales', ctrl.listSales);
router.get('/sales/:id', ctrl.viewSale);

router.get('/inventory-reports', ctrl.listInventoryReports);

module.exports = router;
