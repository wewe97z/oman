import {
  getCategories,
  getDashboardStats,
  getSources,
  getVolumes,
  searchArticles,
} from '../src/lib/db';

console.log('==============================================================');
console.log('تقرير تهيئة وفحص الموسوعة العُمانية الرقمية الذكية');
console.log('==============================================================');

const stats = getDashboardStats();
const categories = getCategories();
const volumes = getVolumes();
const sources = getSources();
const sampleSearch = searchArticles({ query: 'الدوله البوسعيديه', status: 'all_public' });

console.log(`- إجمالي التصنيفات الموسوعية: ${categories.length}`);
console.log(`- إجمالي المجلدات الموسوعية: ${volumes.length}`);
console.log(`- إجمالي المصادر الرسمية والأكاديمية والدولية المسجلة: ${sources.length}`);
console.log(`- إجمالي المقالات المخزنة في قاعدة البيانات: ${stats.totalArticles}`);
console.log(`  * المقالات المنشورة والموثقة: ${stats.publishedArticles}`);
console.log(`  * المقالات قيد المراجعة التحريرية: ${stats.underReviewArticles}`);
console.log(`- اختبار محرك البحث العربي المطبّع («الدوله البوسعيديه»): ${sampleSearch.total} نتائج في ${sampleSearch.executionTimeMs}ms`);
console.log('==============================================================');
