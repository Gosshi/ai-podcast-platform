begin;

set local search_path = public, auth, extensions;

delete from public.episodes
where id in (
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000004',
  '10000000-0000-0000-0000-000000000005'
);

insert into public.episodes (
  id,
  lang,
  status,
  title,
  description,
  script,
  script_polished,
  script_polished_preview,
  audio_url,
  published_at,
  created_at,
  episode_date,
  genre
)
values
  (
    '10000000-0000-0000-0000-000000000001',
    'ja',
    'published',
    '今週のテック判断：AI作業環境とサブスク見直し',
    '生成AIの作業環境をアップデートすべきか、ChatGPTの追加プランは本当に必要か。今週中に決めたいテック周りの判断を整理します。',
    'AIノート環境の更新判断、ChatGPT追加契約の見極め、旧来の文字起こしサービス整理。今週のテック判断3本をまとめます。',
    E'こんにちは、「判断のじかん」へようこそ。今日はテック周りで今週中に片付けたい判断を3つ取り上げます。\n\nまず1つ目、AIノート環境のアップデートについて。最近、生成AIを使った作業が増えてきて、今のノートPCだと処理が追いつかない場面が出てきていませんか？GPU増設という手もありますが、実はクラウドベースの軽量AI環境に切り替えるほうが手っ取り早いケースが多いんです。ポイントは「今週のボトルネックがどこにあるか」。ビルド時間なのか、文字起こし速度なのか、それともメモリ不足なのか。今夜30分だけ試用環境を作って、実際にビルドと文字起こしを回してみてください。時間単価1,200円以下で回るなら、切り替える価値ありです。\n\n2つ目、ChatGPT系の追加プラン契約。Team版やPro版が気になっている方、多いと思います。ただ、ワークフローが固まっていない段階で課金を増やすと、結局使いこなせずにお金だけ飛んでいく。今週の使用回数をメモしてみてください。3回以上ヘビーに使う場面があったなら、来週改めて検討しましょう。月額3,000円以内で既存ツールとの重複が70%以下、これが判断ラインです。\n\n3つ目、旧来の単体文字起こしサービス。AI環境を更新する前にSaaSだけ増やしても、判断のノイズが増えるだけ。今月は見送りが正解です。既存フローの速度を測り終えてから考えても遅くありません。\n\n今日のまとめ：AI環境は今夜試す、ChatGPTプランは今週の使用頻度を見てから、単体SaaSは今月ステイ。それでは、良い判断を。',
    'AI作業環境のアップデートから追加サブスクの要否まで、今週決めたいテック判断3本を時間単価とボトルネックの視点で整理します。',
    '/audio/10000000-0000-0000-0000-000000000001.ja.wav',
    (timezone('utc', now()) - interval '1 day' - interval '2 hours'),
    (timezone('utc', now()) - interval '1 day' - interval '4 hours'),
    ((timezone('utc', now()) - interval '1 day' - interval '2 hours') at time zone 'Asia/Tokyo')::date,
    'tech'
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    'ja',
    'published',
    'ゲーム予算会議：Game Passと積みゲーの落としどころ',
    '週末のゲーム時間をどう使うか。Game Passの短期加入、セール中の長編RPG、復帰コストの重い運営型タイトルを時間単価で比較します。',
    'Game Pass短期加入、長編RPGセール、運営型タイトルの復帰判断。週末ゲーム予算の3本立てです。',
    E'こんにちは、「判断のじかん」ゲーム回です。週末のゲーム時間、どう使うか迷っていませんか？今日は3つの選択肢を並べて、時間単価で整理していきます。\n\nまず、Game Passの短期加入について。友達と週末に協力プレイする予定がある方、これは「やる」判断でいきましょう。ただし条件があります。参加人数が確定していて、2本以上遊ぶタイトルがあること。1,000円以下の短期プランで週末4時間以上遊べるなら、時間単価は250円以下。映画1本より安いです。今日の夜までに一緒に遊ぶ人と「何を遊ぶか」を決めてしまいましょう。\n\n次に、セール中の長編RPG。70%オフとか見ると心が揺れますよね。でも、ちょっと待ってください。今週、そのRPGに6時間以上割ける余裕はありますか？長編RPGは着手までのハードルが高くて、買ったまま積むパターンが一番もったいない。今週の空き時間が6時間を超えそうなら購入候補に戻す、それまではウィッシュリストに入れておくだけで十分です。\n\n最後に、しばらく離れていた運営型タイトルへの復帰。これは今月は見送りましょう。追いつくまでの時間と復帰後の課金圧を考えると、月2,000円以上かかるケースがほとんどです。復帰ボーナスやカムバックキャンペーンが来るまで、静かに待つのが賢い選択です。\n\nまとめると、Game Passは人と予定が揃えばゴー、セールRPGは時間が取れるまで待ち、運営型は来月以降。メリハリつけて、いい週末を過ごしましょう。',
    '週末のゲーム予算をどう配分するか。Game Pass、セールRPG、運営型タイトルの3択を時間単価で切り分けます。',
    '/audio/10000000-0000-0000-0000-000000000002.ja.wav',
    (timezone('utc', now()) - interval '3 days' - interval '3 hours'),
    (timezone('utc', now()) - interval '3 days' - interval '5 hours'),
    ((timezone('utc', now()) - interval '3 days' - interval '3 hours') at time zone 'Asia/Tokyo')::date,
    'games'
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    'ja',
    'published',
    'サブスク棚卸し：動画配信サービスの断捨離術',
    '広告なしプランへの復帰、見逃しシリーズの追いかけ、重複契約の整理。動画配信まわりの「続ける・止める・様子見」を判断します。',
    '動画配信の広告なしプラン復帰、見逃しシリーズ再開、重複契約の整理。サブスク断捨離の判断3本です。',
    E'こんにちは、「判断のじかん」です。今日のテーマは動画配信サービスの棚卸し。みなさん、月額いくら払っているか、パッと答えられますか？\n\nまず、広告なしプランへの一時復帰について。これは「配信終了が近い作品が複数ある週」だけ使うのが正解です。今夜までに見たい作品を3本に絞ってみてください。今週中に全部見切れそうなら、追加コスト1,500円以内で広告なしプランに切り替える価値があります。ダラダラ契約し続けるんじゃなくて、必要な週だけピンポイントで使う。これがサブスク上手の鉄則です。\n\n2つ目、見逃し中のシリーズの追いかけ。新作が毎週更新されるシリーズ、追いかけるのが大変ですよね。ここで大事なのは「積み上がり速度」です。自分の消化ペースより配信ペースのほうが速いなら、今は無理に追わなくていい。新作更新が止まる週か、週末に2時間以上まとまった時間が取れるタイミングを待ちましょう。\n\n3つ目、重複する動画配信の契約。NetflixもAmazonもU-NEXTも全部入っている方、カタログの重複率を確認してみてください。8割以上被っているサービスがあるなら、今月は片方を止めましょう。視聴予定が曖昧なまま契約を増やすのは、一番もったいないお金の使い方です。\n\n今日の判断ライン：広告なしプランは作品3本以上で復帰、見逃しシリーズは時間が取れるまで待ち、重複サブスクは今月中に1つ整理。スッキリした配信ライフを目指しましょう。',
    '動画配信サービス、本当に全部必要ですか？広告なしプランの使いどころから重複契約の整理まで、今月のサブスク断捨離を提案します。',
    '/audio/10000000-0000-0000-0000-000000000003.ja.wav',
    (timezone('utc', now()) - interval '6 days' - interval '1 hour'),
    (timezone('utc', now()) - interval '6 days' - interval '3 hours'),
    ((timezone('utc', now()) - interval '6 days' - interval '1 hour') at time zone 'Asia/Tokyo')::date,
    'streaming'
  ),
  (
    '10000000-0000-0000-0000-000000000004',
    'ja',
    'published',
    '今季アニメの賢い追いかけ方とイベント参加判断',
    'ライブ配信イベントのチケット購入、今季アニメの効率的な追いかけ方、一挙視聴課金の見送り。アニメ周りの判断を整理します。',
    '配信イベントチケット判断、今季アニメの追いかけ再開、一挙視聴課金の見送り。アニメ判断3本です。',
    E'こんにちは、「判断のじかん」アニメ回です。今季も気になる作品が多くて、時間もお金も足りない…そんな方に向けて、今日は3つの判断を整理します。\n\nまず、配信イベント付きチケットの購入判断。声優トークやスタッフコメンタリー付きの配信イベント、8,000円前後のものが増えていますよね。これは「今夜の予定が空いているかどうか」がすべてです。アーカイブがあるかも確認してください。リアルタイムで見る満足度が高いイベントなら、今夜予定が空いている時点で買い。迷う時間がもったいないです。一緒に見る友達がいるなら、なおさらですね。\n\n2つ目、今季アニメの追いかけ再開。3話くらいで脱落した作品、気になっていませんか？ここで焦る必要はありません。判断基準はシンプルで、「次の更新日までに2話分の時間が取れるか」。取れるなら再開、取れないなら引き続き様子見です。追加課金なしで見られるかどうかも重要なポイント。今入っているサブスクの範囲で追えるなら気軽に再開できますが、別サービスへの加入が必要なら優先度を下げましょう。\n\n3つ目、一挙視聴のための追加課金。「全話一気に見たいから有料チャンネル入ろう」という誘惑、わかります。でも今月は見送りです。理由はシンプルで、積んでいる作品がまだあるから。配信終了日が迫ってくるまでは、手持ちの作品を消化するほうが満足度は高いです。\n\nまとめ：イベントは今夜空いてるなら即決、今季アニメは2話分の時間を確保してから、一挙課金は積み消化が先。楽しいアニメライフを。',
    'イベントチケットは買うべきか、脱落した今季アニメに追いつくべきか。アニメ周りの「やる・待つ・見送る」を整理します。',
    '/audio/10000000-0000-0000-0000-000000000004.ja.wav',
    (timezone('utc', now()) - interval '9 days' - interval '4 hours'),
    (timezone('utc', now()) - interval '9 days' - interval '6 hours'),
    ((timezone('utc', now()) - interval '9 days' - interval '4 hours') at time zone 'Asia/Tokyo')::date,
    'anime'
  ),
  (
    '10000000-0000-0000-0000-000000000005',
    'ja',
    'published',
    '映画と配信の整理術：観るべき1本の見つけ方',
    '配信終了間近のドキュメンタリー、カタログ入れ替え時期の再契約判断、今月見ない映画パックの見送り。映画周りの判断をまとめます。',
    '配信終了前のドキュメンタリー視聴、ストリーミング再契約の見極め、映画パックの見送り。映画判断3本です。',
    E'こんにちは、「判断のじかん」映画回です。配信で映画を観る時代、選択肢が多すぎて逆に何も観ない…なんてことになっていませんか？今日は映画周りの判断を3つ整理します。\n\n1つ目、配信終了間近のドキュメンタリー。これは今日中に観てください。判断は明快で、「終了が近くて、かつ学びが大きい作品」は優先枠に入れるべきです。今夜90分の時間を確保できるなら、それだけで十分。観終わったらメモアプリに要点を3つだけ残しておくと、後から「観てよかった」と思える確率が格段に上がります。翌日の予定を確認して、今夜にゆとりがあるなら迷わず再生ボタンを押しましょう。\n\n2つ目、動画配信サービスの再契約。カタログの入れ替え時期って、再契約のタイミングを見極めるのが難しいんですよね。ポイントは「今月追加される作品数」です。週末に観たい作品が3本以上入ってくるなら、月額1,200円以内のプランで再契約する価値あり。逆に、今月のラインナップがピンとこないなら来月まで待ちましょう。他のサービスで配信終了する作品との兼ね合いも見ておくと、判断の精度が上がります。\n\n3つ目、映画見放題パックの追加契約。カタログが魅力的に見えても、今月の視聴予定が具体的にないなら加入しないでください。月額1,000円超のパックは、最低でも月3本観る見込みがないと元が取れません。来月の連休が見えてきたら、そのタイミングで改めて検討しましょう。\n\nまとめ：配信終了作品は今夜90分で消化、再契約はカタログ入れ替えを見てから、映画パックは来月再検討。良い映画体験を。',
    '配信終了が迫る作品をどう優先するか、再契約のベストタイミングはいつか。映画好きのための判断ガイドをお届けします。',
    '/audio/10000000-0000-0000-0000-000000000005.ja.wav',
    (timezone('utc', now()) - interval '13 days' - interval '2 hours'),
    (timezone('utc', now()) - interval '13 days' - interval '4 hours'),
    ((timezone('utc', now()) - interval '13 days' - interval '2 hours') at time zone 'Asia/Tokyo')::date,
    'movies'
  );

insert into public.episode_judgment_cards (
  id,
  episode_id,
  lang,
  genre,
  topic_order,
  topic_title,
  frame_type,
  judgment_type,
  judgment_summary,
  action_text,
  deadline_at,
  threshold_json,
  watch_points_json,
  confidence_score,
  created_at,
  updated_at
)
values
  (
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'ja',
    'tech',
    1,
    'GPU増設より先にAIノート環境を更新する',
    'Frame A',
    'use_now',
    '今週の作業で詰まっているのがノートPC側なら、クラウドの軽量AI環境に切り替えるのが一番早い。ハードを買い足すより先に、まず環境を変えてみましょう。',
    '今夜の作業前に試用環境を立ち上げて、30分でビルドと文字起こしを1回ずつ流してみてください。問題なく回れば切り替え確定です。',
    (timezone('utc', now()) + interval '18 hours'),
    '{"time_limit":[{"raw":"30分以内に検証","value":30,"unit":"minute","label":"検証時間"}],"unit_cost":[{"raw":"1時間あたり1,200円以下","value":1200,"unit":"JPY/hour","label":"時間単価"}]}'::jsonb,
    '["build時間","文字起こし速度","メモリ使用量"]'::jsonb,
    0.92,
    (timezone('utc', now()) + interval '4 days'),
    (timezone('utc', now()))
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    'ja',
    'tech',
    2,
    'ChatGPT追加プランはワークフローが固まるまで様子見',
    'Frame B',
    'watch',
    'TeamプランやProプランは魅力的ですが、使い方が定まっていない段階で課金を増やしても持て余すだけ。まずは今の使い方を1週間記録してみましょう。',
    '今週の使用回数をメモしておいて、3回以上ガッツリ使う場面があったら来週Teamプラン候補として再評価してください。',
    (timezone('utc', now()) + interval '42 hours'),
    '{"monthly_cost":[{"raw":"月額3,000円以内","value":3000,"unit":"JPY","label":"月額"}],"ratio":[{"raw":"既存契約の70%以内で統合","value":70,"unit":"percent","label":"重複率"}]}'::jsonb,
    '["使用回数","既存ツールとの差分","共同編集頻度"]'::jsonb,
    0.74,
    (timezone('utc', now()) + interval '6 days'),
    (timezone('utc', now()))
  ),
  (
    '20000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000001',
    'ja',
    'tech',
    3,
    '単体の文字起こしサービスは今月見送り',
    'Frame D',
    'skip',
    'AI環境全体を見直している最中に、単体のSaaSだけ増やしても管理が複雑になるだけです。既存フローの速度を測り終えてから判断しても遅くありません。',
    '新しい支払い先を増やさず、まずは今の環境でどこが詰まっているかを洗い出すことに集中してください。',
    null,
    '{"other":["新しい支払い先を増やさない"]}'::jsonb,
    '["既存フローの詰まり箇所"]'::jsonb,
    0.66,
    (timezone('utc', now()) + interval '30 hours'),
    (timezone('utc', now()))
  ),
  (
    '20000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000002',
    'ja',
    'games',
    1,
    '週末のGame Pass短期加入は仲間と予定が揃えばゴー',
    'Frame A',
    'use_now',
    '遊ぶ相手と時間がすでに決まっているなら、短期加入で十分元が取れます。1,000円以下で週末4時間遊べれば、時間単価は映画以下です。',
    '今日の夜までに参加メンバーと遊ぶタイトルを確定させてください。2本以上遊ぶなら加入、1本だけなら見送りです。',
    (timezone('utc', now()) - interval '1 day'),
    '{"play_time":[{"raw":"週末4時間以上遊ぶ","value":4,"unit":"hour","label":"想定プレイ時間"}],"price":[{"raw":"1,000円以下なら許容","value":1000,"unit":"JPY","label":"加入コスト"}]}'::jsonb,
    '["参加人数","遊ぶタイトル数","翌週に持ち越すか"]'::jsonb,
    0.88,
    (timezone('utc', now()) + interval '60 hours'),
    (timezone('utc', now()))
  ),
  (
    '20000000-0000-0000-0000-000000000005',
    '10000000-0000-0000-0000-000000000002',
    'ja',
    'games',
    2,
    'セール中の長編RPGは空き時間を確認してから',
    'Frame C',
    'watch',
    '70%オフは確かに魅力ですが、買っても積んでしまえば0%オフと同じです。今週6時間以上の空き時間を確保できるか、まず確認しましょう。',
    'ウィッシュリストに入れておいて、今週の空き時間が6時間を超えたら購入候補に戻してください。セール終了日も忘れずにチェック。',
    (timezone('utc', now()) + interval '9 hours'),
    '{"play_time":[{"raw":"着手まで6時間確保","value":6,"unit":"hour","label":"開始条件"}],"price":[{"raw":"5,000円未満なら検討","value":5000,"unit":"JPY","label":"価格"}]}'::jsonb,
    '["今週の空き時間","他の積みゲー進捗"]'::jsonb,
    0.71,
    (timezone('utc', now()) + interval '70 hours'),
    (timezone('utc', now()))
  ),
  (
    '20000000-0000-0000-0000-000000000006',
    '10000000-0000-0000-0000-000000000002',
    'ja',
    'games',
    3,
    '復帰コストが重い運営型タイトルは来月まで待ち',
    'Frame D',
    'skip',
    '久しぶりに戻ろうとすると、追いつくまでの時間と課金圧がセットで襲ってきます。月2,000円以上かかりそうなら今月は見送りが賢明です。',
    '復帰ボーナスやカムバックキャンペーンのお知らせが来るまで静かに待ちましょう。焦って戻るより、条件が揃ってから戻るほうが楽しめます。',
    null,
    '{"monthly_cost":[{"raw":"月額2,000円超なら見送り","value":2000,"unit":"JPY","label":"継続課金"}]}'::jsonb,
    '["復帰ボーナス","追いつくまでの時間"]'::jsonb,
    0.69,
    (timezone('utc', now()) - interval '8 days'),
    (timezone('utc', now()) - interval '6 days')
  ),
  (
    '20000000-0000-0000-0000-000000000007',
    '10000000-0000-0000-0000-000000000003',
    'ja',
    'streaming',
    1,
    '広告なしプランは配信終了ラッシュの週だけ復帰する',
    'Frame B',
    'use_now',
    '今週中に見終えたい作品が3本以上あるなら、広告なしプランに一時復帰する価値があります。ダラダラ続けるのではなく、必要な週だけ使うのがコツです。',
    '今夜までに視聴リストを3本に絞ってください。今週中に消化できる見込みがあるなら、追加1,500円以内で切り替えてOKです。',
    (timezone('utc', now())),
    '{"watch_time":[{"raw":"今週3本以上見る","value":3,"unit":"titles","label":"視聴本数"}],"monthly_cost":[{"raw":"追加コスト1,500円以内","value":1500,"unit":"JPY","label":"追加コスト"}]}'::jsonb,
    '["配信終了日","広告時間","一気見できる夜"]'::jsonb,
    0.85,
    (timezone('utc', now()) - interval '7 days'),
    (timezone('utc', now()) - interval '5 days')
  ),
  (
    '20000000-0000-0000-0000-000000000008',
    '10000000-0000-0000-0000-000000000003',
    'ja',
    'streaming',
    2,
    '見逃しシリーズは配信ペースが落ち着くまで待機',
    'Frame C',
    'watch',
    '毎週更新される作品に追いつこうとして疲弊するより、更新が落ち着くタイミングを待つほうが賢いです。消化ペースより配信ペースが速いなら、今は追わなくてOK。',
    '新作配信が止まる週か、週末に2時間以上まとまった時間が取れるタイミングで再開してください。焦らなくて大丈夫です。',
    null,
    '{"watch_time":[{"raw":"週2時間以上確保できたら再開","value":2,"unit":"hour","label":"再開条件"}],"monthly_cost":[{"raw":"重複契約を増やさない","value":1,"unit":"rule","label":"重複抑制"}]}'::jsonb,
    '["新作更新ペース","見終わるまでの話数","他サービスとの重複"]'::jsonb,
    0.79,
    (timezone('utc', now()) - interval '6 days'),
    (timezone('utc', now()) - interval '4 days')
  ),
  (
    '20000000-0000-0000-0000-000000000009',
    '10000000-0000-0000-0000-000000000003',
    'ja',
    'streaming',
    3,
    'カタログが8割被っている配信サービスは1つ整理',
    'Frame D',
    'skip',
    '「なんとなく入ったまま」の配信サービス、カタログの重複率を確認してみてください。8割以上被っているなら、片方は今月止めて問題ありません。',
    '今月の視聴実績が出るまで新しい契約は追加しないでください。まず重複を減らすことが先です。',
    null,
    '{"ratio":[{"raw":"既存契約と8割重複なら見送り","value":80,"unit":"percent","label":"重複率"}]}'::jsonb,
    '["視聴実績","重複カタログ率"]'::jsonb,
    0.76,
    (timezone('utc', now()) - interval '5 days'),
    (timezone('utc', now()) - interval '3 days')
  ),
  (
    '20000000-0000-0000-0000-000000000010',
    '10000000-0000-0000-0000-000000000004',
    'ja',
    'anime',
    1,
    '配信イベントのチケットは今夜空いてるなら即決',
    'Frame A',
    'use_now',
    '声優トークやスタッフコメンタリー付きイベント、迷っている時間がもったいないです。今夜の予定が空いていて、8,000円以内なら買ってしまいましょう。',
    '今夜の予定を確認して、空いていればチケットを確保。アーカイブの有無もチェックしておくと安心です。一緒に見る人がいるならさらに楽しめます。',
    (timezone('utc', now())),
    '{"price":[{"raw":"8,000円以内","value":8000,"unit":"JPY","label":"上限"}],"time_limit":[{"raw":"今夜中に判断","value":1,"unit":"day","label":"判断期限"}]}'::jsonb,
    '["翌日の予定","アーカイブ有無","同時視聴相手"]'::jsonb,
    0.82,
    (timezone('utc', now()) - interval '4 days'),
    (timezone('utc', now()) - interval '2 days')
  ),
  (
    '20000000-0000-0000-0000-000000000011',
    '10000000-0000-0000-0000-000000000004',
    'ja',
    'streaming',
    2,
    '今季アニメの追いかけは2話分の時間が取れてから',
    'Frame C',
    'watch',
    '3話で脱落した作品が気になる気持ち、わかります。でも焦る必要はありません。次の更新日までに2話分の時間が取れるかどうかで判断しましょう。',
    '追加課金なしで今のサブスク内で見られるか確認してください。別サービスへの加入が必要なら、優先度を1段下げましょう。',
    (timezone('utc', now())),
    '{"watch_time":[{"raw":"2話分の時間が取れたら再開","value":2,"unit":"episodes","label":"再開条件"}],"monthly_cost":[{"raw":"追加課金なしで追えること","value":0,"unit":"JPY","label":"追加課金"}]}'::jsonb,
    '["更新日","一気見できる休日","他の積み作品"]'::jsonb,
    0.73,
    (timezone('utc', now()) - interval '3 days' - interval '12 hours'),
    (timezone('utc', now()) - interval '2 days' - interval '12 hours')
  ),
  (
    '20000000-0000-0000-0000-000000000012',
    '10000000-0000-0000-0000-000000000004',
    'ja',
    'anime',
    3,
    '一挙視聴のための追加課金は積み消化が先',
    'Frame D',
    'skip',
    '「全話一気見したいから有料チャンネルに入ろう」という気持ちはわかりますが、今月はまだ積んでいる作品があるはず。そちらを先に片付けましょう。',
    '配信終了日が迫ってくるまでは手持ちの作品消化を優先してください。終了日が近づいたら改めて判断しましょう。',
    null,
    '{"other":["今月は積み作品の消化を優先"]}'::jsonb,
    '["積み作品数","配信終了日"]'::jsonb,
    0.64,
    (timezone('utc', now()) - interval '5 days'),
    (timezone('utc', now()) - interval '5 days')
  ),
  (
    '20000000-0000-0000-0000-000000000013',
    '10000000-0000-0000-0000-000000000005',
    'ja',
    'tech',
    1,
    '配信終了間近のドキュメンタリーは今夜観る',
    'Frame A',
    'use_now',
    '終了が近くて学びが大きい作品は、迷わず今日の優先枠に入れてください。90分あれば十分です。観終わったら要点を3つだけメモしておくと、満足度が格段に上がります。',
    '今夜90分の時間を確保して、再生ボタンを押してください。翌日の予定を確認して、ゆとりがある夜がベストです。',
    (timezone('utc', now())),
    '{"watch_time":[{"raw":"90分を確保","value":90,"unit":"minute","label":"必要時間"}],"time_limit":[{"raw":"今日中に視聴開始","value":1,"unit":"day","label":"期限"}]}'::jsonb,
    '["配信終了時刻","見終えた後のメモ","翌日の予定"]'::jsonb,
    0.9,
    (timezone('utc', now()) - interval '5 days'),
    (timezone('utc', now()) - interval '4 days')
  ),
  (
    '20000000-0000-0000-0000-000000000014',
    '10000000-0000-0000-0000-000000000005',
    'ja',
    'streaming',
    2,
    '配信サービスの再契約はカタログ入れ替えを見てから',
    'Frame C',
    'watch',
    '今月のカタログ入れ替えが見えるまで、再契約は急がなくて大丈夫です。週末に観たい作品が3本以上追加されるなら、そのタイミングで判断しましょう。',
    '週末に追加予定の作品リストをチェックして、3本以上あれば月額1,200円以内で再契約を検討してください。',
    (timezone('utc', now())),
    '{"monthly_cost":[{"raw":"再契約は月額1,200円以内","value":1200,"unit":"JPY","label":"月額"}],"watch_time":[{"raw":"週末3本以上視聴予定","value":3,"unit":"titles","label":"再契約条件"}]}'::jsonb,
    '["追加予定作品数","他サービスの終了作品","週末の可処分時間"]'::jsonb,
    0.77,
    (timezone('utc', now()) - interval '4 days' - interval '12 hours'),
    (timezone('utc', now()) - interval '3 days')
  ),
  (
    '20000000-0000-0000-0000-000000000015',
    '10000000-0000-0000-0000-000000000005',
    'ja',
    'movies',
    3,
    '映画見放題パックは来月の連休まで見送り',
    'Frame B',
    'skip',
    'カタログが魅力的でも、今月の視聴予定が具体的にないなら加入する必要はありません。月額1,000円超のパックは月3本観ないと元が取れません。',
    '来月の連休や長期休みが見えてきたら、そのタイミングで改めて検討してください。今月は他の配信サービスで十分です。',
    null,
    '{"monthly_cost":[{"raw":"追加1,000円超なら見送り","value":1000,"unit":"JPY","label":"月額"}]}'::jsonb,
    '["今月の視聴本数","配信終了予定"]'::jsonb,
    0.68,
    (timezone('utc', now()) - interval '3 days'),
    (timezone('utc', now()) - interval '2 days')
  );

update public.episodes as episode
set judgment_cards = cards.payload
from (
  select
    episode_id,
    jsonb_agg(
      jsonb_build_object(
        'topic_title',
        topic_title,
        'frame_type',
        frame_type,
        'judgment_type',
        judgment_type,
        'judgment_summary',
        judgment_summary,
        'action_text',
        action_text,
        'deadline_at',
        deadline_at,
        'threshold_json',
        threshold_json,
        'watch_points_json',
        watch_points_json,
        'confidence_score',
        confidence_score
      )
      order by topic_order
    ) as payload
  from public.episode_judgment_cards
  where episode_id in (
    '10000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000005'
  )
  group by episode_id
) as cards
where episode.id = cards.episode_id;

update public.episode_judgment_cards as card
set
  deadline_at = patch.deadline_at,
  created_at = patch.created_at,
  updated_at = patch.updated_at
from (
  values
    ('20000000-0000-0000-0000-000000000001'::uuid, timezone('utc', now()) + interval '18 hours', timezone('utc', now()) - interval '1 day' - interval '3 hours', timezone('utc', now()) - interval '1 day' - interval '3 hours'),
    ('20000000-0000-0000-0000-000000000002'::uuid, timezone('utc', now()) + interval '4 days', timezone('utc', now()) - interval '1 day' - interval '150 minutes', timezone('utc', now()) - interval '1 day' - interval '150 minutes'),
    ('20000000-0000-0000-0000-000000000003'::uuid, null::timestamptz, timezone('utc', now()) - interval '1 day' - interval '120 minutes', timezone('utc', now()) - interval '1 day' - interval '120 minutes'),
    ('20000000-0000-0000-0000-000000000004'::uuid, timezone('utc', now()) + interval '42 hours', timezone('utc', now()) - interval '3 days' - interval '4 hours', timezone('utc', now()) - interval '3 days' - interval '4 hours'),
    ('20000000-0000-0000-0000-000000000005'::uuid, timezone('utc', now()) + interval '6 days', timezone('utc', now()) - interval '3 days' - interval '210 minutes', timezone('utc', now()) - interval '3 days' - interval '210 minutes'),
    ('20000000-0000-0000-0000-000000000006'::uuid, null::timestamptz, timezone('utc', now()) - interval '3 days' - interval '180 minutes', timezone('utc', now()) - interval '3 days' - interval '180 minutes'),
    ('20000000-0000-0000-0000-000000000007'::uuid, timezone('utc', now()) + interval '30 hours', timezone('utc', now()) - interval '6 days' - interval '2 hours', timezone('utc', now()) - interval '6 days' - interval '2 hours'),
    ('20000000-0000-0000-0000-000000000008'::uuid, null::timestamptz, timezone('utc', now()) - interval '6 days' - interval '90 minutes', timezone('utc', now()) - interval '6 days' - interval '90 minutes'),
    ('20000000-0000-0000-0000-000000000009'::uuid, null::timestamptz, timezone('utc', now()) - interval '6 days' - interval '60 minutes', timezone('utc', now()) - interval '6 days' - interval '60 minutes'),
    ('20000000-0000-0000-0000-000000000010'::uuid, timezone('utc', now()) - interval '1 day', timezone('utc', now()) - interval '9 days' - interval '5 hours', timezone('utc', now()) - interval '9 days' - interval '5 hours'),
    ('20000000-0000-0000-0000-000000000011'::uuid, timezone('utc', now()) + interval '60 hours', timezone('utc', now()) - interval '9 days' - interval '270 minutes', timezone('utc', now()) - interval '9 days' - interval '270 minutes'),
    ('20000000-0000-0000-0000-000000000012'::uuid, null::timestamptz, timezone('utc', now()) - interval '9 days' - interval '240 minutes', timezone('utc', now()) - interval '9 days' - interval '240 minutes'),
    ('20000000-0000-0000-0000-000000000013'::uuid, timezone('utc', now()) + interval '9 hours', timezone('utc', now()) - interval '13 days' - interval '3 hours', timezone('utc', now()) - interval '13 days' - interval '3 hours'),
    ('20000000-0000-0000-0000-000000000014'::uuid, timezone('utc', now()) + interval '70 hours', timezone('utc', now()) - interval '13 days' - interval '150 minutes', timezone('utc', now()) - interval '13 days' - interval '150 minutes'),
    ('20000000-0000-0000-0000-000000000015'::uuid, null::timestamptz, timezone('utc', now()) - interval '13 days' - interval '120 minutes', timezone('utc', now()) - interval '13 days' - interval '120 minutes')
) as patch(id, deadline_at, created_at, updated_at)
where card.id = patch.id;

-- =================================================================
-- Demo auth users (password: local-demo-pass)
-- =================================================================
-- Clean up any existing demo users first
delete from auth.users where email in ('demo-free@local.test', 'demo-paid@local.test');

insert into auth.users (
  id, instance_id, aud, role, email,
  encrypted_password, email_confirmed_at,
  created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token,
  email_change, email_change_token_new, email_change_token_current,
  email_change_confirm_status,
  phone, phone_change, phone_change_token,
  reauthentication_token,
  is_super_admin, is_sso_user, is_anonymous
)
values
  (
    'a0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'demo-free@local.test',
    crypt('local-demo-pass', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"デモ無料ユーザー"}',
    '', '',
    '', '', '', 0,
    null, '', '',
    '',
    false, false, false
  ),
  (
    'a0000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'demo-paid@local.test',
    crypt('local-demo-pass', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"デモ有料ユーザー"}',
    '', '',
    '', '', '', 0,
    null, '', '',
    '',
    false, false, false
  );

-- Ensure identities exist (required for Supabase Auth login)
insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
values
  (
    'a0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'demo-free@local.test',
    '{"sub":"a0000000-0000-0000-0000-000000000001","email":"demo-free@local.test"}',
    'email', now(), now(), now()
  ),
  (
    'a0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000002',
    'demo-paid@local.test',
    '{"sub":"a0000000-0000-0000-0000-000000000002","email":"demo-paid@local.test"}',
    'email', now(), now(), now()
  );

-- Grant paid subscription to demo-paid user
insert into public.subscriptions (user_id, plan_type, status, current_period_end)
values (
  'a0000000-0000-0000-0000-000000000002',
  'pro_monthly',
  'active',
  now() + interval '1 year'
)
on conflict do nothing;

commit;
