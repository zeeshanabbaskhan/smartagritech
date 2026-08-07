/** Canonical managed list type names (ListType.name in DB). */
export const LIST_TYPE_NAMES = {
  PROTOCOLS: 'Protocols and Drivers',
  ACQUISITION: 'Acquisition Methods',
  PRODUCTS: 'Product Catalog',
}

export const DEFAULT_PROTOCOL_OPTIONS = [
  'Modbus TCP',
  'Modbus ASCII',
  'Modbus RTU',
  'AC500 RTU',
  'AC500 TCP',
  'M100 IO',
  'M100-AUTO',
  '2DI 2AI 2DO',
  '4DI 4DO',
  '6DI 6DO',
]

export const DEFAULT_ACQUISITION_OPTIONS = [
  'Edge Computing',
  'Cloud Polling',
  'Modbus RTU',
  'Modbus TCP',
  'Modbus ASCII',
]
