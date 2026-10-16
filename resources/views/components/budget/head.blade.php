{{-- Budget app <head> pieces of the former v2-test/index.html, unchanged --}}
@verbatim
  <script>
    (function () {
      var P = "svitest:", S = Storage.prototype;
      var g = S.getItem, st = S.setItem, r = S.removeItem;
      S.getItem = function (k) { return g.call(this, P + k); };
      S.setItem = function (k, v) { return st.call(this, P + k, v); };
      S.removeItem = function (k) { return r.call(this, P + k); };
      var o = indexedDB.open.bind(indexedDB);
      indexedDB.open = function (n, v) { return o("svitest_" + n, v); };
      window.SVI_TEST = true;
    })();
  </script>
@endverbatim
<link
    rel="stylesheet"
    href="{{ asset('budget/styles.css') }}?v=129"
  >
