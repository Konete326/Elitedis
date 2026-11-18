import { cloudinaryImageSchema } from './shared.schemas.js';
import { User } from './User.model.js';
import { Distributor } from './Distributor.model.js';
import { Company } from './Company.model.js';
import { Brand } from './Brand.model.js';
import { Category } from './Category.model.js';
import { Product } from './Product.model.js';
import { Warehouse } from './Warehouse.model.js';
import { StockBatch } from './StockBatch.model.js';
import { StockMovement } from './StockMovement.model.js';
import { Customer } from './Customer.model.js';
import { Territory } from './Territory.model.js';
import { BeatPlan } from './BeatPlan.model.js';
import { CommercialRule } from './CommercialRule.model.js';
import { PrintTemplate } from './PrintTemplate.model.js';
import { Order } from './Order.model.js';
import { DispatchSheet } from './DispatchSheet.model.js';
import { SaleInvoice } from './SaleInvoice.model.js';
import { Recovery } from './Recovery.model.js';
import { PendingTask } from './PendingTask.model.js';
import { AccountLedger } from './AccountLedger.model.js';
import { AttendancePayroll } from './AttendancePayroll.model.js';
import { Notification } from './Notification.model.js';
import { AuditLog } from './AuditLog.model.js';

const IMAGE_FIELD_NAMES = new Set([
  'logo',
  'coverImage',
  'image',
  'shopPic',
  'avatar',
  'receiptImage',
]);

function applySafeSchemaDefaults(schema, visited = new WeakSet()) {
  if (!schema || visited.has(schema)) return;
  visited.add(schema);

  schema.eachPath((pathName, schemaType) => {
    if (pathName === '_id' || pathName === '__v') return;

    if (schemaType.instance === 'ObjectId') {
      schemaType.set((v) => (v === '' || v === undefined ? null : v));
      return;
    }

    if (schemaType.instance === 'Array' && schemaType.caster?.instance === 'ObjectId') {
      schemaType.set((arr) =>
        Array.isArray(arr) ? arr.filter((v) => v !== '' && v !== null && v !== undefined) : []
      );
      return;
    }

    if (schemaType.schema) {
      const leafName = pathName.split('.').pop();
      if (
        schemaType.schema === cloudinaryImageSchema ||
        IMAGE_FIELD_NAMES.has(pathName) ||
        IMAGE_FIELD_NAMES.has(leafName)
      ) {
        schemaType.set((v) => (v && typeof v === 'object' ? v : { url: '', publicId: '' }));
      }
      applySafeSchemaDefaults(schemaType.schema, visited);
    }
  });

  for (const child of schema.childSchemas || []) {
    if (child?.schema) {
      applySafeSchemaDefaults(child.schema, visited);
    }
  }
}

const allModels = {
  User,
  Distributor,
  Company,
  Brand,
  Category,
  Product,
  Warehouse,
  StockBatch,
  StockMovement,
  Customer,
  Territory,
  BeatPlan,
  CommercialRule,
  PrintTemplate,
  Order,
  DispatchSheet,
  SaleInvoice,
  Recovery,
  PendingTask,
  AccountLedger,
  AttendancePayroll,
  Notification,
  AuditLog,
};

for (const Model of Object.values(allModels)) {
  applySafeSchemaDefaults(Model.schema);
}

export {
  User,
  Distributor,
  Company,
  Brand,
  Category,
  Product,
  Warehouse,
  StockBatch,
  StockMovement,
  Customer,
  Territory,
  BeatPlan,
  CommercialRule,
  PrintTemplate,
  Order,
  DispatchSheet,
  SaleInvoice,
  Recovery,
  PendingTask,
  AccountLedger,
  AttendancePayroll,
  Notification,
  AuditLog,
};

export default allModels;
