/* DIGIY GO DRIVER — vocabulaire chauffeur FR WO AR */
(function(){"use strict";
var vocab={
  module:"DRIVER",
  label:"Je conduis",
  version:"driver-vocab-fr-wo-ar-20260528",
  languages:["fr","wo","ar"],
  doctrine:"Le client ou le chauffeur parle en français, wolof ou arabe. DRIVER prépare la course. Le chauffeur valide. PAY reçoit seulement l'argent final confirmé.",
  intents:{
    trip:["course","trajet","départ","depart","arrivée","arrivee","destination","prise en charge","pickup","retour","aller","aéroport","aeroport","AIBD","yoon","dem","dikk","jël","dellu","aeroport","رحلة","مشوار","انطلاق","وصول","وجهة","مطار","رجوع"],
    schedule:["aujourd'hui","demain","après-demain","apres-demain","heure","matin","soir","maintenant","tay","suba","gannaaw suba","waxtu","suba si","guddi","اليوم","غدا","بعد غد","ساعة","صباح","مساء","الآن"],
    price:["tarif","prix","montant","course à","course a","frais","njëg","fay","xaalis","سعر","ثمن","مبلغ","أجرة"],
    message:["message client","copier","whatsapp","sms","prévenir","prevenir","bataaxal","watsap","sms","yégal","رسالة","واتساب","إس إم إس","إخبار"]
  },
  fields:{
    client:["client","nom","passager","kiliyaan","tur","nit ki","زبون","اسم","راكب"],
    phone:["téléphone","telephone","tel","numéro","numero","telefon","nimero","هاتف","رقم"],
    departure:["départ","depart","depuis","prise en charge","lieu départ","fu mu jóge","jël","انطلاق","من","مكان الانطلاق"],
    arrival:["arrivée","arrivee","destination","vers","à","a","fu mu dem","dikk","إلى","وجهة","وصول"],
    time:["heure","horaire","à","a","waxtu","ساعة","وقت"],
    baggage:["bagage","valise","sac","colis","bagaas","sakku","pake","حقيبة","شنطة","طرد"],
    payment:["cash","wave","orange money","carte","xaalis","kesh","كاش","وايف","أورنج موني","بطاقة"]
  },
  examples:["client Awa départ Saly arrivée AIBD demain 8h tarif 25000 Wave","Awa jóge Saly dem AIBD suba 8h, njëg 25000 Wave","الزبونة أوا من سالي إلى المطار غدا الساعة 8، السعر 25000 وايف"],
  payBridge:{allowed:true,from:"DRIVER_FINAL",phrasePrefix:"recette course DRIVER",onlyAfterDriverValidation:true},
  safety:["aucune course confirmée automatiquement","aucun prix imposé","aucun paiement validé sans clic chauffeur"]
};
window.DIGIY_GO_VOCABS=window.DIGIY_GO_VOCABS||{};
window.DIGIY_GO_VOCABS.DRIVER=vocab;
window.DIGIY_GO_DRIVER_VOCAB=vocab;
})();