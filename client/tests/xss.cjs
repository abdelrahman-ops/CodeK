const { JSDOM } = require('jsdom');
const createDOMPurify = require('dompurify');

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

function sanitizeHtml(rawHtml) {
  if (!rawHtml) return '';
  return DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'span', 'b', 'i', 'strong', 'em', 'u', 's', 'strike',
      'ul', 'ol', 'li',
      'pre', 'code', 'blockquote',
      'hr', 'br',
      'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'img'
    ],
    ALLOWED_ATTR: [
      'href', 'target', 'rel', 'src', 'alt', 'title', 'class', 'width', 'height'
    ],
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    ADD_ATTR: ['target', 'rel'],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'style'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur']
  });
}

console.log('--- Testing XSS Sanitization Vectors ---');

// 1. Script injection
const scriptPayload = '<p>Safe Text</p><script>alert("pwned")</script>';
const cleanScript = sanitizeHtml(scriptPayload);
console.log('Vector 1 (Script tag):', cleanScript);
if (cleanScript.includes('<script') || cleanScript.includes('alert')) {
  throw new Error('FAIL: Script tag was not removed!');
}

// 2. Inline event handler (onerror)
const onerrorPayload = '<img src="invalid.jpg" onerror="alert(document.cookie)">';
const cleanOnerror = sanitizeHtml(onerrorPayload);
console.log('Vector 2 (Inline onerror):', cleanOnerror);
if (cleanOnerror.includes('onerror') || cleanOnerror.includes('document.cookie')) {
  throw new Error('FAIL: onerror handler was not stripped!');
}

// 3. javascript: link protocol
const jsLinkPayload = '<a href="javascript:alert(1)">Click Me</a>';
const cleanJsLink = sanitizeHtml(jsLinkPayload);
console.log('Vector 3 (javascript: link):', cleanJsLink);
if (cleanJsLink.includes('javascript:')) {
  throw new Error('FAIL: javascript: URI was not neutralized!');
}

// 4. Malicious iframe
const iframePayload = '<iframe src="https://evil.com"></iframe>';
const cleanIframe = sanitizeHtml(iframePayload);
console.log('Vector 4 (Malicious iframe):', cleanIframe);
if (cleanIframe.includes('<iframe')) {
  throw new Error('FAIL: iframe tag was not blocked!');
}

// 5. Legitimate Markdown/HTML content
const legitimateHtml = '<h1>Chapter 1</h1><p>Welcome to <strong>CodeK</strong>. Learn <a href="https://codek.academy">online</a>.</p>';
const cleanLegit = sanitizeHtml(legitimateHtml);
console.log('Vector 5 (Legitimate HTML):', cleanLegit);
if (!cleanLegit.includes('<h1>Chapter 1</h1>') || !cleanLegit.includes('<strong>CodeK</strong>')) {
  throw new Error('FAIL: Legitimate content was mangled!');
}

console.log('\nAll 5 XSS Vectors Successfully Verified! PASS ✅');
