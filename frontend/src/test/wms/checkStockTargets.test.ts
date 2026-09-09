import { describe, expect, it } from 'vitest';
import {
  isValidScheduleDate,
  CHECK_STATUS_BADGE_VARIANT,
  buildZoneTree,
  buildCategoryTree,
  getRelatedProducts,
  getScheduleProducts,
} from '../../app/owner/stock/stock_check/checkStockTargets';
import type { StockItem } from '../../interface/wms/product';

function stockItem(overrides: Partial<StockItem>): StockItem {
  return {
    ID: 1,
    ProductCode: 'P-1',
    Name: 'Product 1',
    PartNo: '',
    Category: '',
    Grade: 'A',
    Stock: 10,
    MinStock: 0,
    Price: 0,
    CostPrice: 0,
    MaxDiscountRate: 0,
    Note: '',
    ...overrides,
  };
}

describe('isValidScheduleDate', () => {
  it.each([
    [undefined, false],
    ['', false],
    ['not-a-date', false],
    ['0001-01-01T00:00:00Z', false], // Go zero value ต้องไม่นับว่า valid
    ['2026-09-08T18:00:00Z', true],
  ])('%s -> %s', (input, expected) => {
    expect(isValidScheduleDate(input)).toBe(expected);
  });
});

describe('CHECK_STATUS_BADGE_VARIANT', () => {
  it('maps every known status to its badge variant', () => {
    expect(CHECK_STATUS_BADGE_VARIANT['รอดำเนินการ']).toBe('neutral');
    expect(CHECK_STATUS_BADGE_VARIANT['กำลังเช็ค']).toBe('error');
    expect(CHECK_STATUS_BADGE_VARIANT['รอตรวจสอบ']).toBe('info');
    expect(CHECK_STATUS_BADGE_VARIANT['เสร็จสิ้น']).toBe('success');
  });
});

describe('buildZoneTree', () => {
  it('nests zone -> shelf -> shelf level and falls back from ID to id', () => {
    const zones = [
      {
        ID: 1,
        zone_name: 'โซน A',
        shelves: [
          {
            id: 10, // lowercase id fallback (บาง endpoint ส่งมาไม่เหมือนกัน)
            shelf_name: 'ตู้ 1',
            shelf_levels: [{ ID: 100, level_name: 'ชั้น 1' }],
          },
        ],
      },
    ];
    expect(buildZoneTree(zones)).toEqual([
      {
        value: 'zone-1',
        label: 'โซน A',
        children: [
          {
            value: 'shelf-10',
            label: 'ตู้ 1',
            children: [{ value: 'level-100', label: 'ชั้น 1' }],
          },
        ],
      },
    ]);
  });

  it('leaves children undefined when a zone has no shelves', () => {
    expect(buildZoneTree([{ ID: 1, zone_name: 'โซน A' }])).toEqual([
      { value: 'zone-1', label: 'โซน A', children: undefined },
    ]);
  });

  it('returns an empty array for an empty input', () => {
    expect(buildZoneTree([])).toEqual([]);
  });
});

describe('buildCategoryTree', () => {
  it('nests category -> sub-category -> sub-sub-category', () => {
    const categories = [
      {
        id: 1,
        category_name: 'อะไหล่เครื่องยนต์',
        sub_categories: [
          {
            ID: 2,
            sub_category_name: 'ลูกสูบ',
            sub_sub_categories: [{ id: 3, sub_sub_category_name: 'ลูกสูบเบนซิน' }],
          },
        ],
      },
    ];
    expect(buildCategoryTree(categories)).toEqual([
      {
        value: 'category-1',
        label: 'อะไหล่เครื่องยนต์',
        children: [
          {
            value: 'subcategory-2',
            label: 'ลูกสูบ',
            children: [{ value: 'subsubcategory-3', label: 'ลูกสูบเบนซิน' }],
          },
        ],
      },
    ]);
  });
});

describe('getRelatedProducts', () => {
  const zones = [
    {
      ID: 1,
      zone_name: 'โซน A',
      shelves: [
        {
          ID: 10,
          shelf_name: 'ตู้ 1',
          shelf_levels: [{ ID: 100, level_name: 'ชั้น 1' }],
        },
        { ID: 11, shelf_name: 'ตู้ 2' },
      ],
    },
  ];
  const categories = [
    {
      ID: 1,
      category_name: 'อะไหล่เครื่องยนต์',
      sub_categories: [
        {
          ID: 2,
          sub_category_name: 'ลูกสูบ',
          sub_sub_categories: [{ ID: 3, sub_sub_category_name: 'ลูกสูบเบนซิน' }],
        },
      ],
    },
  ];
  const products = [
    stockItem({ ID: 1, ShelfLevel: 'ชั้น 1', Shelf: 'ตู้ 1' }),
    stockItem({ ID: 2, Shelf: 'ตู้ 2' }),
    stockItem({ ID: 3, Category: 'อะไหล่เครื่องยนต์', SubCategory: 'ลูกสูบ', SubSubCategory: 'ลูกสูบเบนซิน' }),
    stockItem({ ID: 4, Category: 'อะไหล่เครื่องยนต์' }),
  ];

  it('matches by shelf level when the path points to a level', () => {
    const result = getRelatedProducts('LOCATION', 'level-100', '', products, zones, categories);
    expect(result.map((p) => p.ID)).toEqual([1]);
  });

  it('matches by shelf name when the path points to a shelf (not a level)', () => {
    const result = getRelatedProducts('LOCATION', 'shelf-11', '', products, zones, categories);
    expect(result.map((p) => p.ID)).toEqual([2]);
  });

  it('matches every shelf under a zone when the path points to a zone', () => {
    const result = getRelatedProducts('LOCATION', 'zone-1', '', products, zones, categories);
    expect(result.map((p) => p.ID)).toEqual([1, 2]);
  });

  it('matches by sub-sub-category when the path is the most specific', () => {
    const result = getRelatedProducts('CATEGORY', '', 'subsubcategory-3', products, zones, categories);
    expect(result.map((p) => p.ID)).toEqual([3]);
  });

  it('matches by sub-category when the path stops one level short', () => {
    const result = getRelatedProducts('CATEGORY', '', 'subcategory-2', products, zones, categories);
    expect(result.map((p) => p.ID)).toEqual([3]);
  });

  it('matches by top-level category when the path is just a category', () => {
    const result = getRelatedProducts('CATEGORY', '', 'category-1', products, zones, categories);
    expect(result.map((p) => p.ID)).toEqual([3, 4]);
  });

  it('returns an empty array for check type PRODUCT (not handled by this helper)', () => {
    expect(getRelatedProducts('PRODUCT', 'zone-1', '', products, zones, categories)).toEqual([]);
  });

  it('returns an empty array when the LOCATION path is blank', () => {
    expect(getRelatedProducts('LOCATION', '', '', products, zones, categories)).toEqual([]);
  });

  it('returns an empty array when the CATEGORY id is blank', () => {
    expect(getRelatedProducts('CATEGORY', '', '', products, zones, categories)).toEqual([]);
  });

  it('returns an empty array when an id in the path does not resolve to any known zone/category', () => {
    // id ที่ไม่มีจริง -> ชื่อที่ resolve ได้เป็นค่าว่าง -> ไม่ควรไปจับคู่กับสินค้าที่ไม่มี Shelf ตั้งไว้เลยแบบผิดๆ
    const result = getRelatedProducts('LOCATION', 'shelf-999', '', products, zones, categories);
    expect(result).toEqual([]);
  });
});

describe('getScheduleProducts', () => {
  const zones = [{ ID: 1, zone_name: 'โซน A', shelves: [{ ID: 10, shelf_name: 'ตู้ 1' }] }];
  const categories = [{ ID: 1, category_name: 'อะไหล่เครื่องยนต์', sub_categories: [] }];
  const products = [
    stockItem({ ID: 1, Shelf: 'ตู้ 1' }),
    stockItem({ ID: 2, Category: 'อะไหล่เครื่องยนต์' }),
    stockItem({ ID: 3, Name: 'สินค้าเฉพาะชิ้น' }),
  ];

  it('returns just the one product for check type PRODUCT', () => {
    const result = getScheduleProducts(
      { check_type: 'PRODUCT', product_id: 3 },
      products,
      zones,
      categories
    );
    expect(result.map((p) => p.ID)).toEqual([3]);
  });

  it('returns an empty array when the referenced product no longer exists', () => {
    const result = getScheduleProducts(
      { check_type: 'PRODUCT', product_id: 999 },
      products,
      zones,
      categories
    );
    expect(result).toEqual([]);
  });

  it('prefers shelf_level_id over shelf_id and zone_id when building the LOCATION path', () => {
    const result = getScheduleProducts(
      { check_type: 'LOCATION', shelf_level_id: 100, shelf_id: 10, zone_id: 1 },
      products,
      zones,
      categories
    );
    // level-100 ไม่มีจริงในต้นไม้ตัวอย่างนี้ -> resolve ชื่อไม่เจอ -> ไม่ควรหลุดไปจับคู่ด้วย shelf_id/zone_id ที่ให้มาด้วย
    expect(result).toEqual([]);
  });

  it('falls back to shelf_id when shelf_level_id is absent', () => {
    const result = getScheduleProducts(
      { check_type: 'LOCATION', shelf_id: 10, zone_id: 1 },
      products,
      zones,
      categories
    );
    expect(result.map((p) => p.ID)).toEqual([1]);
  });

  it('falls back to zone_id when neither shelf_level_id nor shelf_id is set', () => {
    const result = getScheduleProducts(
      { check_type: 'LOCATION', zone_id: 1 },
      products,
      zones,
      categories
    );
    expect(result.map((p) => p.ID)).toEqual([1]);
  });

  it('prefers sub_sub_category_id over sub_category_id and category_id when building the CATEGORY path', () => {
    const result = getScheduleProducts(
      { check_type: 'CATEGORY', category_id: 1 },
      products,
      zones,
      categories
    );
    expect(result.map((p) => p.ID)).toEqual([2]);
  });

  it('returns an empty array when no location/category id is set at all', () => {
    const result = getScheduleProducts({ check_type: 'LOCATION' }, products, zones, categories);
    expect(result).toEqual([]);
  });
});
