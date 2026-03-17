/**
 * How to run:
 * k6 run hw01_iwant/baseline.js
 */
import http from 'k6/http';
import { group, sleep, check } from 'k6';
import { Rate } from 'k6/metrics';
import { parseHTML } from 'k6/html';

export const suggestionsOk = new Rate('suggestions_ok');
export const listOk = new Rate('list_ok');


const BASE_URL = "https://ecommerce-playground.lambdatest.io/";
const ITEM = "iphone";
const SUGGEST_URL = "https://ecommerce-playground.lambdatest.io/index.php?route=extension/maza/product/product/autocomplete&filter_name="+ITEM;
const LIST_URL = "https://ecommerce-playground.lambdatest.io/index.php?route=product%2Fsearch&search="+ITEM;
const PRODUCT_ID = 40;
const PRODUCT_URL ="https://ecommerce-playground.lambdatest.io/index.php?route=product/product&product_id="+PRODUCT_ID;

export const options = {
  vus: 1,
  duration: '5m',
  thresholds: { 
    http_req_duration: ['p(95)<1000'],
    checks: ['rate>0.9'],
    suggestions_ok: ['rate==1.0'],
    list_ok: ['rate==1.0'],
    'http_req_duration{name:product_detail}': ['p(95)<1500'],
    'http_req_duration{name:list_check}': ['p(95)<1300'],
  }
}

export default async function () {
    const res = http.get(BASE_URL);

    check(res, {
        'homepage status is 200': (r) => r.status === 200,
    });

    group('suggestion_check', () => {
        const suggestRes = http.get(SUGGEST_URL);

        check(res, {
        'suggestion list status is 200': (r) => r.status === 200,
        });

        let count = 0;
        check(suggestRes.body, {
        'at least 3 items in suggestions': (html) => {
            const doc = parseHTML(html);

            
            doc.find('li.product-thumb h4.title a').each((_, a) => {
            // For each <a> title, get its text (via its innerHTML / parse again)
            const name = parseHTML(a.innerHTML()).text().trim(); 
            if (name.toLowerCase().includes('iphone') && ++count >= 3) return false; 
            });

            return count >= 3;
        },
        });

        const passed = count >= 3;
        suggestionsOk.add(passed); 
    });

    
    group('list_check', () => {
        const listRes = http.get(LIST_URL, {
            tags: { name: 'list_check' },
        });
        check(res, {
            'Product page status is 200': (r) => r.status === 200,
        });

        let count = 0;

        //console.log(listRes.body)
        const ok = check(listRes, {
        'at least 4 iphone products on page': (r) => {
            const doc = parseHTML(r.body);

            // grab all product title anchors
            const titles = doc.find('.product-thumb h4.title a');

            // iterate and count
            titles.each((_, a) => {
            const name = (a.innerHTML() || '').trim().toLowerCase();
            if (name.includes(ITEM)) count++;
            });

            return count >= 4;
        },
        });

        // optional debug (avoid in heavy load)
        // console.log(`iphoneCount=${count}`);

        listOk.add(ok); // if listOk is a Rate metric, ok is perfect
    });

    group('product_detail', () => {
        const productRes = http.get(PRODUCT_URL, {
            tags: { name: 'product_detail' },
        });


        check(productRes, {
            'Product detail status is 200': (r) => r.status === 200,
            "Product detail loads faster than 1500ms": (r) => r.timings.duration <= 1500
        });
    });    



    sleep(1)
}