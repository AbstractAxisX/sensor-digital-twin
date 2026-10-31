/**
 * WaveLab Sensor Framework — پوشه‌ی سنسورها
 *
 * هر سنسور یک پوشه‌ی اختصاصی دارد:
 *   sensors/hc-sr04   → دوقلوی دیجیتال HC-SR04 (اولتراسونیک)
 *
 * چارچوب مشترک: sensors/core
 */
export * from './core/types';
export * from './core/materials';
export * from './core/acoustic';
export * from './hc-sr04';
