// Move to browser support / polyfill
// if (!Element.prototype.closest) {
//   Element.prototype.closest = function closest(s) {
//     let el = this;

//     do {
//       if (el.matches(s)) {
//         return el;
//       }

//       el = el.parentElement || el.parentNode;
//     } while (el !== null && el.nodeType === 1);

//     return null;
//   };
// }