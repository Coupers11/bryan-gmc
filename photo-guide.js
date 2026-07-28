/* Guided vehicle photography — the shot list, the coaching and the example sheet.
 *
 * Two tools ask a customer to photograph the same car: the trade evaluator and
 * the express check-in. When the copy lived in both files it drifted within a
 * week, so the wording, the shot list and the example images live here and both
 * pages load this. Each page still draws its own tiles — only the teaching is
 * shared, because the teaching is the part that has to match.
 *
 * Example images live in photo-examples/ next to this file. A shot whose example
 * hasn't been photographed yet falls back to a framing note, so a missing file
 * degrades to "read this" rather than a broken image.
 */
(function (w, d) {
  "use strict";

  var SHOTS = [
  { k:"tr_front", t:"Front Corner", ic:"🚗", req:1, ex:"front.jpg",
    h:"Angled — front and one side",
    s:"Stand off the front-left corner so the grille and the driver's side are both in frame.",
    tips:["Back up about ten feet and hold the phone level",
          "Turn the wheels straight before you shoot",
          "Bumper, both front wheels and the roofline all in frame"],
    nos:["Not square-on from dead centre","Not so close the corners crop off"] },

  { k:"tr_rear", t:"Rear Corner", ic:"🔙", req:1, ex:"rear.jpg",
    h:"Angled — back and one side",
    s:"Same idea from the opposite corner, so between the two shots we've seen all four sides.",
    tips:["Off the rear-right corner, ten feet back",
          "Tailgate, bumper and rear wheel all visible",
          "Close the tailgate or hatch first"],
    nos:["Not with the trunk or tailgate open"] },

  { k:"tr_driver", t:"Driver Side", ic:"↔️", req:1, ex:"driver.jpg",
    h:"Full side — show any dings",
    s:"Straight on from the side, far enough back that the whole vehicle fits without zooming.",
    tips:["Stand square to the middle of the vehicle",
          "Get both wheels and the full length in frame",
          "Shoot with the sun behind you, not behind the truck"],
    nos:["Don't zoom in — walk back instead","Don't shoot into your own shadow"] },

  { k:"tr_pass", t:"Passenger Side", ic:"↔️", req:1, ex:"pass.jpg",
    h:"Full side — show any dings",
    s:"The matching shot from the other side. This is where curb rash and door dings usually live.",
    tips:["Square to the middle again, same distance",
          "Full length in frame, both wheels showing"],
    nos:["Don't skip it because \"it's the same as the other side\""] },

  { k:"tr_interior", t:"Interior", ic:"🪑", req:1, ex:"interior.jpg",
    h:"Front seats and dash",
    s:"Open the driver's door and shoot across — dash, both front seats and the console.",
    tips:["Open the door wide and stand outside it",
          "Clear the floor and seats first — a clean car reads as a cared-for car",
          "Turn the dome light on if it's dim"],
    nos:["Not a close-up of the steering wheel","Don't crop the seats out"] },

  { k:"tr_trunk", t:"Trunk / Cargo Area", ic:"🧳", req:1, ex:"trunk.jpg",
    h:"Open it up and shoot straight in",
    s:"Trunk or bed, opened and emptied. It tells us how the vehicle was actually lived in.",
    tips:["Take everything out first, including the floor mat if it lifts",
          "Stand back a step so the whole space is in frame",
          "Show the spare tire well if it lifts easily"],
    nos:["Not with gear or groceries still in it"] },

  { k:"tr_odo", t:"Odometer", ic:"🔢", req:1, ex:"odo.jpg",
    h:"The mileage reading",
    s:"Key on so the cluster lights up, then get close enough that the numbers are sharp.",
    tips:["Turn the key to accessory so the display is lit",
          "Hold steady and let the phone focus before you tap",
          "Every digit readable"],
    nos:["Not through a glare on the cluster — move your angle"] },

  { k:"tr_tread", t:"Tire Tread", ic:"🛞", req:1, ex:"tread.jpg",
    h:"Close-up — how deep is the tread?",
    s:"Crouch at a front tire and shoot straight into the tread. Tires are one of the biggest single swings in an appraisal.",
    tips:["Get within a foot or two of the tread blocks",
          "Shoot straight at the tread, not down at the sidewall",
          "A penny or a quarter in the groove shows depth better than anything"],
    nos:["Not a photo of the wheel and sidewall"] },

  { k:"tr_damage", t:"Point Out Imperfections", ic:"👉", req:0, ex:"damage.jpg",
    h:"Dents, scratches, cracked glass",
    s:"Anything you'd point out if you were walking me around it — so put your finger right on it, like this. A flaw you showed us is priced in. A flaw we find at the appraisal is what changes your number at the desk.",
    tips:["Point at it with your finger so we can't miss it",
          "Get close, but leave enough around it that we can tell where on the vehicle it is",
          "One shot per spot — take as many as you need",
          "Nothing to show? Skip it. That's a good problem to have."],
    nos:["Don't shoot it wet or in direct glare — it hides the depth"] } ];

  var BY = {};
  SHOTS.forEach(function (s) { BY[s.k] = s; });

  var CSS = [
    ".pgx{position:fixed;inset:0;z-index:9000;background:rgba(12,13,16,.8);",
    "  backdrop-filter:blur(4px);display:grid;place-items:end center;padding:0;",
    "  font:15px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#16181d}",
    ".pgx[hidden]{display:none}",
    ".pgx-box{background:#fff;border-radius:18px 18px 0 0;padding:20px 20px 24px;width:100%;",
    "  max-width:540px;max-height:92vh;overflow:auto;box-sizing:border-box}",
    ".pgx-grip{width:38px;height:4px;border-radius:2px;background:#d8d5cf;margin:0 auto 15px}",
    ".pgx-box h3{font:700 19px/1.25 inherit;margin:0 0 5px;color:#16181d;text-transform:none;",
    "  letter-spacing:-.2px}",
    ".pgx-sub{color:#6b6862;font-size:13.5px;margin:0 0 14px}",
    ".pgx-img{display:block;max-width:100%;max-height:46vh;margin:0 auto 14px;border-radius:12px;",
    "  border:1px solid #e7e4de;background:#eceae5}",
    ".pgx-img[hidden]{display:none}",
    ".pgx-ph{width:100%;aspect-ratio:4/3;border-radius:12px;background:#eceae5;box-sizing:border-box;",
    "  border:1px dashed #cfccc5;display:grid;place-items:center;text-align:center;",
    "  padding:18px;margin-bottom:14px}",
    ".pgx-ph[hidden]{display:none}",
    ".pgx-ph em{font-style:normal;font-size:34px;display:block;margin-bottom:9px;opacity:.5}",
    ".pgx-ph i{font-style:normal;font-size:13px;color:#6b6862;line-height:1.45;display:block;max-width:270px}",
    ".pgx-tips{margin:0 0 18px;padding:0;list-style:none}",
    ".pgx-tips li{font-size:13.5px;padding:6px 0 6px 24px;position:relative;line-height:1.45}",
    ".pgx-tips li:before{content:'\\2713';position:absolute;left:0;color:#1a8a4a;font-weight:700}",
    ".pgx-tips li.no:before{content:'\\2715';color:#c8102e}",
    ".pgx-btn{width:100%;background:#c8102e;color:#fff;border:0;border-radius:11px;padding:15px;",
    "  font:700 16px/1 inherit;cursor:pointer;margin-bottom:9px}",
    ".pgx-close{width:100%;background:#fff;color:#6b6862;border:1.5px solid #e7e4de;",
    "  border-radius:11px;padding:13px;font:600 14px/1 inherit;cursor:pointer}"
  ].join("");

  var box, cur = null, onTake = null;

  function build() {
    var st = d.createElement("style"); st.textContent = CSS; d.head.appendChild(st);
    box = d.createElement("div");
    box.className = "pgx"; box.hidden = true;
    box.innerHTML =
      '<div class="pgx-box" role="dialog" aria-modal="true">' +
        '<div class="pgx-grip"></div>' +
        '<h3></h3><p class="pgx-sub"></p>' +
        '<img class="pgx-img" alt="" hidden>' +
        '<div class="pgx-ph" hidden><em></em><i></i></div>' +
        '<ul class="pgx-tips"></ul>' +
        '<button type="button" class="pgx-btn"></button>' +
        '<button type="button" class="pgx-close">Close</button>' +
      "</div>";
    d.body.appendChild(box);
    box.addEventListener("click", function (e) { if (e.target === box) close(); });
    box.querySelector(".pgx-close").addEventListener("click", close);
    box.querySelector(".pgx-btn").addEventListener("click", function () {
      var k = cur, cb = onTake;
      close();
      if (cb) cb(k);
    });
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  /* open(key, { taken: bool, onTake: fn(key) }) */
  function open(k, opt) {
    var s = BY[k];
    if (!s) return;
    if (!box) build();
    opt = opt || {};
    cur = k; onTake = opt.onTake || null;

    box.querySelector("h3").textContent = s.t;
    box.querySelector(".pgx-sub").textContent = s.s;
    box.querySelector(".pgx-tips").innerHTML =
      s.tips.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") +
      s.nos.map(function (t) { return '<li class="no">' + esc(t) + "</li>"; }).join("");

    var img = box.querySelector(".pgx-img"), ph = box.querySelector(".pgx-ph");
    ph.querySelector("em").textContent = s.ic;
    ph.querySelector("i").textContent = s.s;
    img.hidden = true; ph.hidden = false;
    img.onload  = function () { img.hidden = false; ph.hidden = true; };
    img.onerror = function () { img.hidden = true;  ph.hidden = false; };
    img.src = "photo-examples/" + s.ex;

    box.querySelector(".pgx-btn").textContent =
      opt.taken ? "Retake this photo" : "Take this photo";
    box.hidden = false;
    d.body.style.overflow = "hidden";
  }

  function close() {
    if (box) box.hidden = true;
    d.body.style.overflow = "";
  }

  w.PhotoGuide = {
    SHOTS: SHOTS,
    get: function (k) { return BY[k]; },
    required: SHOTS.filter(function (s) { return s.req; }),
    open: open,
    close: close
  };
})(window, document);
