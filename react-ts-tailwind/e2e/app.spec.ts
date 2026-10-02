import { expect, test as base, type Page } from '@playwright/test'
import { FakeSupabase, TEST_PASSWORD } from './fakeSupabase'

const test = base.extend<{ fake: FakeSupabase }>({
  fake: async ({ context }, provide) => {
    const fake = new FakeSupabase()
    await fake.attach(context)
    await provide(fake)
  },
})

type Row = { name: string; score: string; rounds: string }

async function fillRow(page: Page, index: number, row: Row) {
  const n = index + 1
  await page.getByLabel(`第 ${n} 位玩家名字`).fill(row.name)
  await page.getByLabel(`第 ${n} 位玩家金額`).fill(row.score)
  await page.getByLabel(`第 ${n} 位玩家打幾將`).fill(row.rounds)
}

async function unlock(page: Page, password = TEST_PASSWORD) {
  await page.getByRole('navigation').getByRole('button', { name: '解鎖' }).click()
  await page.getByLabel('編輯密碼').fill(password)
  await page.locator('main form').getByRole('button', { name: '解鎖' }).click()
}

const FIVE: Row[] = [
  { name: '阿明', score: '1200', rounds: '2' },
  { name: '小美', score: '-300', rounds: '2' },
  { name: '老王', score: '-500', rounds: '1' },
  { name: '阿華', score: '-600', rounds: '2' },
  { name: '小陳', score: '200', rounds: '1' },
]

/** 場地必填：還沒選場地時填一個 */
async function ensureVenue(page: Page, venue = '樹窩') {
  const input = page.locator('#record-venue')
  if (!(await input.inputValue())) await input.fill(venue)
}

async function createFivePlayerRecord(page: Page) {
  await ensureVenue(page)
  await page.getByRole('button', { name: '＋ 新增玩家' }).click()
  for (const [i, row] of FIVE.entries()) await fillRow(page, i, row)
  await page.locator('#house-fee').fill('400')
  await expect(page.getByTestId('total')).toContainText('平衡')
  await page.getByRole('button', { name: '存檔' }).click()
}

async function createAndOpen(page: Page) {
  await createFivePlayerRecord(page)
  await expect(page.getByRole('heading', { name: '紀錄明細' })).toBeVisible()
}

const nav = (page: Page) => page.getByRole('navigation')

test.describe('唯讀與解鎖', () => {
  test.beforeEach(async ({ page, fake }) => {
    void fake
    await page.goto('/')
  })

  test('一進來是總覽，預設唯讀，看不到新增', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '總覽' })).toBeVisible()
    await expect(page.getByText('還沒有任何紀錄')).toBeVisible()
    await nav(page).getByRole('button', { name: '歷史紀錄' }).click()
    await expect(nav(page).getByRole('button', { name: '新增紀錄' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: '唯讀' })).toBeVisible()
    await expect(page.getByRole('button', { name: '新增第一筆' })).toHaveCount(0)
  })

  test('密碼錯誤顯示錯誤，正確才解鎖', async ({ page }) => {
    await unlock(page, 'wrong-password')
    await expect(page.getByRole('alert')).toContainText('密碼錯誤')
    await expect(nav(page).getByRole('button', { name: '新增紀錄' })).toHaveCount(0)

    await page.getByLabel('編輯密碼').fill(TEST_PASSWORD)
    await page.locator('main form').getByRole('button', { name: '解鎖' }).click()
    await expect(page.getByRole('heading', { name: '新增紀錄' })).toBeVisible()
    await expect(page.getByRole('button', { name: '已解鎖' })).toBeVisible()
    await expect(page.getByRole('button', { name: '唯讀' })).toHaveCount(0)
  })

  test('底色：唯讀也能換，重新整理後記住，換回深色', async ({ page }) => {
    const html = page.locator('html')
    await expect(html).not.toHaveAttribute('data-theme')

    await page.getByRole('button', { name: '選擇底色' }).click()
    await expect(page.getByRole('radio', { name: '深色' })).toHaveAttribute('aria-checked', 'true')
    await page.getByRole('radio', { name: '淺藍' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(html).toHaveAttribute('data-theme', 'sky')
    await expect(page.locator('body')).toHaveCSS('color-scheme', 'light')

    await page.reload()
    await expect(html).toHaveAttribute('data-theme', 'sky')
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#e8f2fb')

    await page.getByRole('button', { name: '選擇底色' }).click()
    await expect(page.getByRole('radio', { name: '淺藍' })).toHaveAttribute('aria-checked', 'true')
    await page.getByRole('radio', { name: '深色' }).click()
    await expect(html).not.toHaveAttribute('data-theme')
    await page.reload()
    await expect(html).not.toHaveAttribute('data-theme')
  })

  test('解鎖後重新整理仍記住', async ({ page }) => {
    await unlock(page)
    await expect(page.getByRole('heading', { name: '新增紀錄' })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('heading', { name: '總覽' })).toBeVisible()
    await expect(nav(page).getByRole('button', { name: '新增紀錄' })).toBeVisible()
    await expect(page.getByRole('button', { name: '唯讀' })).toHaveCount(0)
  })

  test('鎖定後恢復唯讀，明細與名單都不能改', async ({ page }) => {
    await unlock(page)
    await createAndOpen(page)
    await page.getByRole('button', { name: '已解鎖' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: '鎖定' }).click()

    await expect(page.getByRole('heading', { name: '總覽' })).toBeVisible()
    await nav(page).getByRole('button', { name: '歷史紀錄' }).click()
    await page.getByTestId('record-card').click()
    await expect(page.getByRole('heading', { name: '紀錄明細' })).toBeVisible()
    await expect(page.getByRole('button', { name: '編輯' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: '刪除' })).toHaveCount(0)

    await nav(page).getByRole('button', { name: '名單' }).click()
    await expect(page.getByText('阿明')).toBeVisible()
    await expect(page.getByLabel('新增牌咖')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^刪除/ })).toHaveCount(0)

    await page.reload()
    await expect(page.getByRole('button', { name: '唯讀' })).toBeVisible()
  })

  test('密碼在別處被更改後，寫入失敗並回到唯讀', async ({ page, fake }) => {
    await unlock(page)
    await expect(page.getByRole('heading', { name: '新增紀錄' })).toBeVisible()
    fake.password = 'changed-elsewhere'
    await createFivePlayerRecord(page)
    await expect(page.getByRole('heading', { name: '解鎖編輯' })).toBeVisible()
    await expect(page.getByRole('status')).toContainText('密碼已變更')
    expect(fake.records).toHaveLength(0)
  })

  test('記住的密碼失效時，啟動就回到唯讀', async ({ page, fake }) => {
    await unlock(page)
    await expect(page.getByRole('heading', { name: '新增紀錄' })).toBeVisible()
    fake.password = 'changed-elsewhere'
    await page.reload()
    await expect(page.getByRole('heading', { name: '總覽' })).toBeVisible()
    await expect(nav(page).getByRole('button', { name: '新增紀錄' })).toHaveCount(0)
    // 總覽上方顯示提示，點了進解鎖頁
    await page.getByRole('status').filter({ hasText: '密碼已變更' }).click()
    await expect(page.getByRole('heading', { name: '解鎖編輯' })).toBeVisible()
    await expect(page.getByRole('status')).toContainText('密碼已變更')
  })

  test('鎖定前要確認，取消就維持解鎖', async ({ page }) => {
    await unlock(page)
    await page.getByRole('button', { name: '已解鎖' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: '取消' }).click()
    await expect(page.getByRole('button', { name: '已解鎖' })).toBeVisible()
    await expect(nav(page).getByRole('button', { name: '新增紀錄' })).toBeVisible()
    // 已經沒有設定分頁
    await expect(nav(page).getByRole('button', { name: '設定' })).toHaveCount(0)
  })
})

test.describe('紀錄', () => {
  test.beforeEach(async ({ page, fake }) => {
    void fake
    await page.goto('/')
    await unlock(page)
    await expect(page.getByRole('heading', { name: '新增紀錄' })).toBeVisible()
  })

  test('新增超過 4 人的紀錄，存到資料庫', async ({ page, fake }) => {
    await createAndOpen(page)

    const items = page.locator('main ol li')
    await expect(items).toHaveCount(5)
    await expect(items.first()).toContainText('阿明')
    await expect(items.first()).toContainText('+1200')
    await expect(page.getByText('400 元')).toBeVisible()
    await expect(page.getByText('不計入加總')).toBeVisible()
    // 總將數為最高將數（2, 2, 1, 2, 1 → 2）
    await expect(page.locator('dl')).toContainText('總將數2 將')

    expect(fake.records).toHaveLength(1)
    expect(fake.records[0]).toMatchObject({ house_fee: 400, house_fee_in_total: false })
    expect(fake.records[0].record_players.map((p) => p.name)).toEqual(FIVE.map((r) => r.name))

    await page.reload()
    await nav(page).getByRole('button', { name: '歷史紀錄' }).click()
    const card = page.getByTestId('record-card')
    await expect(card).toHaveCount(1)
    await expect(card).toContainText('東錢 400')
    await expect(card).toContainText('5 人')
  })

  test('總和不為 0 時無法存檔，也不會送到資料庫', async ({ page, fake }) => {
    await fillRow(page, 0, { name: 'A', score: '100', rounds: '1' })
    await fillRow(page, 1, { name: 'B', score: '-50', rounds: '1' })
    await fillRow(page, 2, { name: 'C', score: '0', rounds: '1' })
    await fillRow(page, 3, { name: 'D', score: '0', rounds: '1' })
    await expect(page.getByTestId('total')).toContainText('+50，需為 0')

    await page.getByRole('button', { name: '存檔' }).click()
    await expect(page.getByRole('alert')).toContainText('分數總和需為 0')
    await expect(page.getByRole('heading', { name: '新增紀錄' })).toBeVisible()
    expect(fake.rpcCalls).not.toContain('save_record')
  })

  test('東錢計入加總時，玩家金額 + 東錢 = 0 才能存', async ({ page, fake }) => {
    await ensureVenue(page)
    await fillRow(page, 0, { name: 'A', score: '800', rounds: '3' })
    await fillRow(page, 1, { name: 'B', score: '-400', rounds: '3' })
    await fillRow(page, 2, { name: 'C', score: '-300', rounds: '3' })
    await fillRow(page, 3, { name: 'D', score: '-500', rounds: '3' })
    await page.locator('#house-fee').fill('400')
    await expect(page.getByTestId('total')).toContainText('-400，需為 0')

    const toggle = page.getByRole('switch', { name: '東錢計入加總' })
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByTestId('total')).toContainText('玩家 -400 ＋ 東錢 400')
    await expect(page.getByTestId('total')).toContainText('平衡')

    await page.getByRole('button', { name: '存檔' }).click()
    await expect(page.getByRole('heading', { name: '紀錄明細' })).toBeVisible()
    await expect(page.getByText('計入加總', { exact: true })).toBeVisible()
    await expect(page.locator('dl')).toContainText('總將數3 將')
    expect(fake.records[0].house_fee_in_total).toBe(true)

    await page.getByRole('button', { name: '編輯' }).click()
    await expect(page.getByRole('switch', { name: '東錢計入加總' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  test('± 按鈕切換負號', async ({ page }) => {
    const score = page.getByLabel('第 1 位玩家金額')
    await score.fill('300')
    await page.getByRole('button', { name: '切換正負號' }).first().click()
    await expect(score).toHaveValue('-300')
  })

  test('牌咖名單可點選帶入', async ({ page }) => {
    await createAndOpen(page)
    await nav(page).getByRole('button', { name: '新增紀錄' }).click()

    await page.getByLabel('第 1 位玩家名字').click()
    const chips = page.getByLabel('牌咖名單', { exact: true }).getByRole('button')
    await expect(chips).toHaveCount(5)
    await chips.filter({ hasText: '小美' }).click()
    await expect(page.getByLabel('第 1 位玩家名字')).toHaveValue('小美')
    await expect(page.getByLabel('第 1 位玩家金額')).toBeFocused()

    await page.getByLabel('第 2 位玩家名字').click()
    await expect(chips).toHaveCount(4)
    await expect(chips.filter({ hasText: '小美' })).toHaveCount(0)
    await page.getByLabel('第 2 位玩家名字').fill('阿')
    await expect(chips).toHaveCount(2)
  })

  test('刪除牌咖', async ({ page, fake }) => {
    await createAndOpen(page)
    await nav(page).getByRole('button', { name: '名單' }).click()
    await page.getByRole('button', { name: '刪除 小美' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: '移除' }).click()
    await expect(page.getByText('小美')).toHaveCount(0)
    expect(fake.players.map((p) => p.name)).not.toContain('小美')
  })

  test('編輯紀錄後資料正確', async ({ page, fake }) => {
    await createAndOpen(page)
    await page.getByRole('button', { name: '編輯' }).click()
    await expect(page.getByLabel('第 1 位玩家名字')).toHaveValue('阿明')

    await page.getByRole('button', { name: '移除第 5 位玩家' }).click()
    await page.getByLabel('第 1 位玩家金額').fill('1400')
    await page.locator('#house-fee').fill('')
    await page.getByRole('button', { name: '儲存修改' }).click()

    await expect(page.getByRole('heading', { name: '紀錄明細' })).toBeVisible()
    await expect(page.locator('main ol li')).toHaveCount(4)
    await expect(page.locator('main ol li').first()).toContainText('+1400')
    await expect(page.getByText('修改：')).toBeVisible()
    expect(fake.records).toHaveLength(1)
    expect(fake.records[0]).toMatchObject({ house_fee: null })
    expect(fake.records[0].record_players).toHaveLength(4)
  })

  test('取消編輯不變動資料', async ({ page, fake }) => {
    await createAndOpen(page)
    await page.getByRole('button', { name: '編輯' }).click()
    await page.getByLabel('第 1 位玩家金額').fill('9999')
    await page.getByRole('button', { name: '取消' }).click()
    await expect(page.locator('main ol li').first()).toContainText('+1200')
    expect(fake.rpcCalls.filter((c) => c === 'save_record')).toHaveLength(1)
  })

  test('刪除需確認，資料庫為軟刪除', async ({ page, fake }) => {
    await createAndOpen(page)
    await page.getByRole('button', { name: '刪除' }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible()

    await dialog.getByRole('button', { name: '取消' }).click()
    await expect(dialog).toBeHidden()
    expect(fake.rpcCalls).not.toContain('delete_record')

    await page.getByRole('button', { name: '刪除' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: '刪除' }).click()
    await expect(page.getByText('還沒有任何紀錄')).toBeVisible()
    expect(fake.records[0].deleted_at).not.toBeNull()
  })

  test('名單：新增牌咖與場地，記錄時可以點選', async ({ page, fake }) => {
    await nav(page).getByRole('button', { name: '名單' }).click()
    await expect(page.getByRole('heading', { name: '牌咖與場地' })).toBeVisible()

    await page.getByLabel('新增牌咖').fill('  阿明 ')
    await page.getByRole('button', { name: '新增', exact: true }).click()
    await expect(page.getByLabel('新增牌咖')).toHaveValue('')
    await expect(page.getByText('尚未上桌')).toBeVisible()
    expect(fake.players.map((p) => p.name)).toEqual(['阿明'])

    // 重複的名字在前端就擋下
    await page.getByLabel('新增牌咖').fill('阿明')
    await page.getByRole('button', { name: '新增', exact: true }).click()
    await expect(page.getByText('「阿明」已在名單中')).toBeVisible()

    await page.getByRole('tab', { name: /場地/ }).click()
    await expect(page.getByText('還沒有場地')).toBeVisible()
    await page.getByLabel('新增場地').fill('阿明家')
    await page.getByRole('button', { name: '新增', exact: true }).click()
    await expect(page.getByText('阿明家')).toBeVisible()
    await page.getByLabel('新增場地').fill('麻將館')
    await page.getByRole('button', { name: '新增', exact: true }).click()
    await expect(page.getByRole('tab', { name: '場地（2）' })).toBeVisible()
    expect(fake.venues.map((v) => v.name)).toEqual(['阿明家', '麻將館'])

    // 新增紀錄：沒用過的場地不會預設帶入；點選後存檔
    await nav(page).getByRole('button', { name: '新增紀錄' }).click()
    await expect(page.locator('#record-venue')).toHaveValue('')
    const venueChips = page.getByLabel('場地名單').getByRole('button')
    await expect(venueChips).toHaveCount(2)
    await venueChips.filter({ hasText: '麻將館' }).click()
    await expect(page.locator('#record-venue')).toHaveValue('麻將館')
    await expect(venueChips.filter({ hasText: '麻將館' })).toHaveAttribute('aria-pressed', 'true')

    await page.getByLabel('第 1 位玩家名字').click()
    await page.getByLabel('牌咖名單', { exact: true }).getByRole('button', { name: '阿明' }).click()
    await expect(page.getByLabel('第 1 位玩家名字')).toHaveValue('阿明')
    await fillRow(page, 0, { name: '阿明', score: '300', rounds: '1' })
    await fillRow(page, 1, { name: 'B', score: '-100', rounds: '1' })
    await fillRow(page, 2, { name: 'C', score: '-100', rounds: '1' })
    await fillRow(page, 3, { name: 'D', score: '-100', rounds: '1' })
    await page.getByRole('button', { name: '存檔' }).click()

    await expect(page.getByRole('heading', { name: '紀錄明細' })).toBeVisible()
    await expect(page.getByText('📍 麻將館')).toBeVisible()
    expect(fake.records[0].venue).toBe('麻將館')

    // 下一筆預設帶入最近用過的場地
    await nav(page).getByRole('button', { name: '新增紀錄' }).click()
    await expect(page.locator('#record-venue')).toHaveValue('麻將館')

    await nav(page).getByRole('button', { name: '歷史紀錄' }).click()
    await expect(page.getByTestId('record-card')).toContainText('📍 麻將館')
  })

  test('名單：牌咖改名會更新紀錄，名字已存在時合併', async ({ page, fake }) => {
    await createAndOpen(page)
    await nav(page).getByRole('button', { name: '名單' }).click()

    const dialog = page.getByRole('dialog')
    await page.getByRole('button', { name: '幫 阿明 改名' }).click()
    await expect(dialog.getByLabel('新名字')).toHaveValue('阿明')
    await expect(dialog.getByRole('button', { name: '改名' })).toBeDisabled()
    await dialog.getByLabel('新名字').fill(' 大明 ')
    await dialog.getByRole('button', { name: '改名' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(page.getByRole('button', { name: '幫 大明 改名' })).toBeVisible()
    await expect(page.getByRole('button', { name: '幫 阿明 改名' })).toHaveCount(0)
    expect(fake.records[0].record_players.map((p) => p.name)).toContain('大明')

    // 同一筆紀錄裡有這兩個人，不能合併
    await page.getByRole('button', { name: '幫 小陳 改名' }).click()
    await dialog.getByLabel('新名字').fill('老王')
    await expect(dialog).toContainText('兩人的紀錄會合併')
    await dialog.getByRole('button', { name: '合併' }).click()
    await expect(page.getByRole('alert')).toContainText('不能合併')
    expect(fake.records[0].record_players.map((p) => p.name)).toContain('小陳')

    // 沒有共同紀錄的兩個名字可以合併
    await page.getByLabel('新增牌咖').fill('新來的')
    await page.getByRole('button', { name: '新增', exact: true }).click()
    await expect(page.getByRole('tab', { name: '牌咖（6）' })).toBeVisible()
    await page.getByRole('button', { name: '幫 新來的 改名' }).click()
    await dialog.getByLabel('新名字').fill('老王')
    await dialog.getByRole('button', { name: '合併' }).click()
    await expect(page.getByRole('tab', { name: '牌咖（5）' })).toBeVisible()
    expect(fake.players.map((p) => p.name)).not.toContain('新來的')
  })

  test('場地必填：沒選場地不能存', async ({ page, fake }) => {
    await fillRow(page, 0, { name: 'A', score: '100', rounds: '1' })
    await fillRow(page, 1, { name: 'B', score: '-100', rounds: '1' })
    await fillRow(page, 2, { name: 'C', score: '0', rounds: '1' })
    await fillRow(page, 3, { name: 'D', score: '0', rounds: '1' })
    await expect(page.getByTestId('total')).toContainText('平衡')
    await page.getByRole('button', { name: '存檔' }).click()
    await expect(page.getByRole('alert')).toContainText('請選擇場地')
    expect(fake.rpcCalls).not.toContain('save_record')

    await page.locator('#record-venue').fill('樹窩')
    await page.getByRole('button', { name: '存檔' }).click()
    await expect(page.getByRole('heading', { name: '紀錄明細' })).toBeVisible()
  })

  test('記錄時輸入新場地會自動加入名單；清除場地後不能存', async ({ page, fake }) => {
    await page.locator('#record-venue').fill('公司')
    await expect(page.getByText('新場地，存檔後會加入場地名單')).toBeVisible()
    await createAndOpen(page)
    expect(fake.venues.map((v) => v.name)).toEqual(['公司'])

    // 編輯時清除場地
    await page.getByRole('button', { name: '編輯' }).click()
    await expect(page.locator('#record-venue')).toHaveValue('公司')
    await page.getByRole('button', { name: '清除場地' }).click()
    await page.getByRole('button', { name: '儲存修改' }).click()
    await expect(page.getByRole('alert')).toContainText('請選擇場地')
    await expect(page.getByRole('heading', { name: '編輯紀錄' })).toBeVisible()
    expect(fake.records[0].venue).toBe('公司')
  })

  test('刪除場地不影響已存的紀錄', async ({ page, fake }) => {
    await page.locator('#record-venue').fill('阿明家')
    await createAndOpen(page)
    await nav(page).getByRole('button', { name: '名單' }).click()
    await page.getByRole('tab', { name: /場地/ }).click()
    await page.getByRole('button', { name: '刪除 阿明家' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: '移除' }).click()
    await expect(page.getByText('還沒有場地')).toBeVisible()
    expect(fake.venues).toHaveLength(0)

    await nav(page).getByRole('button', { name: '歷史紀錄' }).click()
    await expect(page.getByTestId('record-card')).toContainText('📍 阿明家')
  })

  test('少於 4 人時不能移除玩家', async ({ page }) => {
    await expect(page.getByTestId('player-row')).toHaveCount(4)
    await expect(page.getByRole('button', { name: '移除第 1 位玩家' })).toBeDisabled()
  })

  test('頁面沒有橫向捲動', async ({ page }) => {
    await page.getByRole('button', { name: '＋ 新增玩家' }).click()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })
})

test('其他裝置打開可以看到同一份紀錄（唯讀）', async ({ page, fake, browser }) => {
  await page.goto('/')
  await unlock(page)
  await createAndOpen(page)

  const other = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await fake.attach(other)
  const viewer = await other.newPage()
  await viewer.goto('/')
  await expect(viewer.getByTestId('standing').first()).toContainText('阿明')
  await viewer.getByRole('navigation').getByRole('button', { name: '歷史紀錄' }).click()
  await expect(viewer.getByTestId('record-card')).toContainText('阿明')
  await expect(viewer.getByRole('button', { name: '唯讀' })).toBeVisible()
  await other.close()
})

test('載入失敗時可以重試', async ({ page, fake }) => {
  fake.failReads = true
  await page.goto('/')
  // supabase-js 讀取失敗會自動重試 3 次（約 7 秒）才回報錯誤
  await expect(page.getByText('無法載入紀錄')).toBeVisible({ timeout: 15_000 })
  fake.failReads = false
  await page.getByRole('button', { name: '重試' }).click()
  await expect(page.getByText('還沒有任何紀錄')).toBeVisible()
})

test('總覽：戰績排行與牌咖、場地標籤', async ({ page, fake }) => {
  await page.goto('/')
  await unlock(page)
  await expect(page.getByRole('heading', { name: '新增紀錄' })).toBeVisible()

  const save = async (venue: string, rows: Row[]) => {
    await nav(page).getByRole('button', { name: '新增紀錄' }).click()
    await page.locator('#record-venue').fill(venue)
    for (const [i, row] of rows.entries()) await fillRow(page, i, row)
    await page.getByRole('button', { name: '存檔' }).click()
    await expect(page.getByRole('heading', { name: '紀錄明細' })).toBeVisible()
  }
  await save('樹窩', [
    { name: '阿明', score: '1200', rounds: '2' },
    { name: '小美', score: '-300', rounds: '2' },
    { name: '老王', score: '-500', rounds: '2' },
    { name: '阿華', score: '-400', rounds: '2' },
  ])
  await save('樹窩', [
    { name: '阿明', score: '-200', rounds: '3' },
    { name: '小美', score: '600', rounds: '3' },
    { name: '老王', score: '-100', rounds: '1' },
    { name: '阿華', score: '-300', rounds: '3' },
  ])
  // 手動加一個還沒上過桌的牌咖、一個還沒用過的場地
  await nav(page).getByRole('button', { name: '名單' }).click()
  await page.getByLabel('新增牌咖').fill('小陳')
  await page.getByRole('button', { name: '新增', exact: true }).click()
  await expect(page.getByText('尚未上桌')).toBeVisible()
  await page.getByRole('tab', { name: /場地/ }).click()
  await page.getByLabel('新增場地').fill('公司')
  await page.getByRole('button', { name: '新增', exact: true }).click()
  await expect(page.getByText('尚未使用')).toBeVisible()

  await nav(page).getByRole('button', { name: '總覽' }).click()
  await expect(page.getByRole('heading', { name: '總覽' })).toBeVisible()
  await expect(page.locator('dl').first()).toContainText('總場數2 場')
  await expect(page.locator('dl').first()).toContainText('總將數5 將')

  const rows = page.getByTestId('standing')
  await expect(rows).toHaveCount(4)
  await expect(rows.nth(0)).toContainText('阿明')
  await expect(rows.nth(0)).toContainText('+1000')
  await expect(rows.nth(0)).toContainText('場數2')
  await expect(rows.nth(0)).toContainText('總將數5')
  await expect(rows.nth(0)).toContainText('勝率50%（1/2）')
  await expect(rows.nth(0)).toContainText('每將+200')
  await expect(rows.nth(1)).toContainText('小美')
  await expect(rows.nth(1)).toContainText('+300')
  await expect(rows.nth(3)).toContainText('阿華')
  await expect(rows.nth(3)).toContainText('-700')
  await expect(rows.nth(3)).toContainText('勝率0%（0/2）')

  // 連勝／連敗：阿華、老王兩場都輸 → 2 連敗；阿明最近一場輸、只連 1 場 → 不顯示
  await expect(rows.nth(3).getByTestId('streak')).toHaveText('❄️ 2 連敗')
  await expect(rows.filter({ hasText: '老王' }).getByTestId('streak')).toHaveText('❄️ 2 連敗')
  await expect(rows.nth(0).getByTestId('streak')).toHaveCount(0)
  await expect(rows.nth(1).getByTestId('streak')).toHaveCount(0)

  // 稱號
  const titlesOf = (i: number) => rows.nth(i).getByTestId('title')
  // 阿明有 6 個稱號：先顯示 4 個，其他收在 +2 裡（老王只打 3 將，總將數不是大家都一樣，所以有耐力王）
  await expect(titlesOf(0)).toHaveText([
    '👑 牌王',
    '🏆 冠軍收集者 ×1',
    '🏠 地頭蛇・樹窩',
    '💰 每將最賺',
  ])
  await rows.nth(0).getByRole('button', { name: '顯示其他 2 個稱號' }).click()
  await expect(titlesOf(0)).toHaveCount(6)
  await expect(titlesOf(0).nth(4)).toHaveText('🚀 單場爆發 +1200')
  await expect(titlesOf(0).nth(5)).toHaveText('⏳ 耐力王')
  // 小美只有 1 個，不需要收合
  await expect(rows.nth(1).getByRole('button', { name: /稱號/ })).toHaveCount(0)
  await expect(titlesOf(1)).toContainText(['🏆 冠軍收集者 ×1'])
  await expect(rows.filter({ hasText: '老王' }).getByTestId('title')).toContainText([
    '💣 單場重傷 -500',
  ])
  await expect(titlesOf(3)).toContainText(['💸 慈善家'])
  // 大家場數一樣，不頒全勤獎
  await expect(page.getByTestId('title').filter({ hasText: '全勤獎' })).toHaveCount(0)

  await page.getByText('稱號說明').click()
  await expect(page.getByText('超過 30 天沒上桌')).toBeVisible()

  const players = page.getByLabel('牌咖標籤')
  await expect(players.getByRole('listitem')).toHaveCount(5)
  await expect(players.getByRole('listitem').filter({ hasText: '阿明' })).toContainText('2 場')
  await expect(players.getByRole('listitem').filter({ hasText: '小陳' })).toContainText('0 場')
  const venues = page.getByLabel('場地標籤')
  await expect(venues.getByRole('listitem').filter({ hasText: '樹窩' })).toContainText('2 場')
  await expect(venues.getByRole('listitem').filter({ hasText: '公司' })).toContainText('0 場')
  void fake
})

test('稱號超過 4 個時收成 +N，可以展開與收合', async ({ page, fake }) => {
  const mk = (id: string, date: string, venue: string | null, ps: Record<string, number>) => ({
    id,
    date,
    venue,
    house_fee: null,
    house_fee_in_total: false,
    created_at: date,
    updated_at: date,
    deleted_at: null,
    record_players: Object.entries(ps).map(([name, score], i) => ({
      id: `${id}${i}`,
      position: i + 1,
      name,
      score,
      rounds: 1,
    })),
  })
  // 大樹幾乎每場都贏，會拿到 9 個稱號
  fake.records = [
    mk('a', '2026-08-01', null, { 大樹: 100, 小美: -100, 阿明: 0, 老王: 0 }),
    mk('b', '2026-09-01', '樹窩', { 大樹: 500, 小美: -200, 老王: -200, 阿華: -100 }),
    mk('c', '2026-09-02', '樹窩', { 大樹: 300, 小美: -100, 老王: -100, 阿華: -100 }),
    mk('d', '2026-09-03', null, { 大樹: -100, 小美: 300, 老王: -100, 阿華: -100 }),
    mk('e', '2026-09-04', null, { 大樹: 400, 小美: -100, 老王: -200, 阿華: -100 }),
    mk('f', '2026-09-05', null, { 大樹: 200, 小美: 0, 老王: -100, 阿華: -100 }),
    mk('g', '2026-09-06', null, { 大樹: 100, 小美: -100, 老王: 0, 阿華: 100, 小陳: -100 }),
  ]
  await page.goto('/')
  const top = page.getByTestId('standing').first()
  await expect(top).toContainText('大樹')
  await expect(top.getByTestId('title')).toHaveCount(4)
  await expect(top.getByTestId('title').first()).toHaveText('👑 牌王')

  const more = top.getByRole('button', { name: '顯示其他 5 個稱號' })
  await expect(more).toHaveText('+5')
  await more.click()
  await expect(top.getByTestId('title')).toHaveCount(9)
  await expect(top.getByTestId('title').last()).toHaveText('🎢 雲霄飛車')

  await top.getByRole('button', { name: '收合稱號' }).click()
  await expect(top.getByTestId('title')).toHaveCount(4)
})

/** 直接在假的資料庫放 7 筆紀錄：大樹幾乎都贏 */
function seedSeason(fake: FakeSupabase) {
  const mk = (id: string, date: string, venue: string | null, ps: Record<string, number>) => ({
    id,
    date,
    venue,
    house_fee: null,
    house_fee_in_total: false,
    created_at: date,
    updated_at: date,
    deleted_at: null,
    record_players: Object.entries(ps).map(([name, score], i) => ({
      id: `${id}${i}`,
      position: i + 1,
      name,
      score,
      rounds: 1,
    })),
  })
  fake.records = [
    mk('a', '2026-08-01', null, { 大樹: 100, 小美: -100, 阿明: 0, 老王: 0 }),
    mk('b', '2026-09-01', '樹窩', { 大樹: 500, 小美: -200, 老王: -200, 阿華: -100 }),
    mk('c', '2026-09-02', '樹窩', { 大樹: 300, 小美: -100, 老王: -100, 阿華: -100 }),
    mk('d', '2026-09-03', '公司', { 大樹: -100, 小美: 300, 老王: -100, 阿華: -100 }),
    mk('e', '2026-09-04', null, { 大樹: 400, 小美: -100, 老王: -200, 阿華: -100 }),
    mk('f', '2026-09-05', null, { 大樹: 200, 小美: 0, 老王: -100, 阿華: -100 }),
    mk('g', '2026-09-06', null, { 大樹: 100, 小美: -100, 老王: 0, 阿華: 100, 小陳: -100 }),
  ]
  fake.players = ['大樹', '小美', '老王', '阿華', '小陳', '阿明'].map((name) => ({
    name,
    last_used: '2026-09-06',
    created_at: '2026-08-01',
  }))
  fake.players.push({ name: '新來的', last_used: null, created_at: '2026-09-10' })
}

test('戰績排行顯示剋星與提款機', async ({ page, fake }) => {
  seedSeason(fake)
  await page.goto('/')
  // 用名字按鈕找列，避免「剋星：大樹」這種標籤文字也被比對到
  const row = (name: string) =>
    page
      .getByTestId('standing')
      .filter({ has: page.getByRole('button', { name: `查看 ${name} 的個人數據` }) })
  // 大樹對老王 6 勝 0 負 1 平，淨勝最多
  await expect(row('大樹').getByTestId('atm')).toHaveText('🏧 提款機：老王')
  await expect(row('大樹').getByTestId('nemesis')).toHaveCount(0)
  // 小美對大樹 1 勝 6 負
  await expect(row('小美').getByTestId('nemesis')).toHaveText('😈 剋星：大樹')
  // 小陳只打 1 場，同桌不到 3 場
  await expect(row('小陳').getByTestId('nemesis')).toHaveCount(0)
  await expect(row('小陳').getByTestId('atm')).toHaveCount(0)
})

test('個人頁：數據、名次分布、最近場次、對戰、場地、每月', async ({ page, fake }) => {
  seedSeason(fake)
  await page.goto('/')
  await page.getByRole('button', { name: '查看 大樹 的個人數據' }).click()
  await expect(page.getByRole('heading', { level: 1, name: '大樹' })).toBeVisible()
  await expect(nav(page).getByRole('button', { name: '總覽' })).toHaveAttribute('aria-current', 'page')

  // A. 頁首：稱號全部展開，不收合
  const header = page.getByRole('region', { name: '個人總覽' })
  await expect(header).toContainText('+1500')
  await expect(header).toContainText('第 1 名')
  await expect(header.getByTestId('streak')).toHaveText('🔥 3 連勝')
  await expect(header.getByTestId('title')).toHaveCount(9)
  await expect(header.getByRole('button', { name: /稱號/ })).toHaveCount(0)
  await expect(header.getByTestId('atm')).toHaveText('🏧 提款機：老王')

  // B. 數據格
  const stats = page.getByLabel('個人數據')
  await expect(stats).toContainText('場數7')
  await expect(stats).toContainText('冠軍6 次')
  await expect(stats).toContainText('單場最高+500')
  await expect(stats).toContainText('單場最低-100')
  await expect(stats).toContainText('平均名次1.1')

  // C. 名次分布
  const ranks = page.getByLabel('名次分布')
  await expect(ranks.getByRole('listitem').nth(0)).toContainText('6 次')
  await expect(ranks.getByRole('listitem').nth(1)).toContainText('1 次')

  // D. 走勢圖
  await expect(page.getByRole('img', { name: /共 7 場，目前 \+1500/ })).toBeVisible()

  // F. 對戰分析
  const h2h = (name: string) => page.getByTestId('h2h').filter({ hasText: name })
  await expect(h2h('小美')).toContainText('6 勝 1 負')
  await expect(h2h('老王')).toContainText('6 勝 0 負 1 平')
  await expect(h2h('老王')).toContainText('🏧')

  // G. 場地：樹窩 2 場 +800 是主場；公司只有 1 場，不算客場魔咒
  await expect(page.getByTestId('home')).toHaveText('🏠 主場：樹窩')
  await expect(page.getByTestId('away')).toHaveCount(0)
  await expect(page.getByTestId('venue-stat').filter({ hasText: '樹窩' })).toContainText('+800')

  // H. 每月
  const months = page.getByLabel('每月表現')
  await expect(months.getByRole('listitem').nth(0)).toContainText('2026/08')
  await expect(months.getByRole('listitem').nth(0)).toContainText('+100')
  await expect(months.getByRole('listitem').nth(1)).toContainText('+1400')
  await expect(months.getByRole('listitem').nth(1)).toContainText('6 場')
})

test('個人頁：點最近場次、點對手，返回鍵回到上一頁', async ({ page, fake }) => {
  seedSeason(fake)
  await page.goto('/')
  await page.getByRole('button', { name: '查看 大樹 的個人數據' }).click()

  // E. 最近場次，新到舊
  const recent = page.getByLabel('最近場次').getByRole('button')
  await expect(recent).toHaveCount(7)
  await expect(recent.first()).toContainText('2026/09/06')
  await recent.first().click()
  await expect(page.getByRole('heading', { name: '紀錄明細' })).toBeVisible()
  await page.getByRole('button', { name: '返回' }).click()
  await expect(page.getByRole('heading', { level: 1, name: '大樹' })).toBeVisible()

  // 點對手進對手的個人頁，再返回
  await page.getByTestId('h2h').filter({ hasText: '小美' }).getByRole('button').click()
  await expect(page.getByRole('heading', { level: 1, name: '小美' })).toBeVisible()
  await expect(page.getByRole('region', { name: '個人總覽' }).getByTestId('nemesis')).toHaveText(
    '😈 剋星：大樹',
  )
  await page.getByRole('button', { name: '返回' }).click()
  await expect(page.getByRole('heading', { level: 1, name: '大樹' })).toBeVisible()
  await page.getByRole('button', { name: '返回' }).click()
  await expect(page.getByRole('heading', { name: '總覽' })).toBeVisible()
})

test('從名單和總覽標籤都能進個人頁；沒上過桌的不能點', async ({ page, fake }) => {
  seedSeason(fake)
  await page.goto('/')
  await page.getByLabel('牌咖標籤').getByRole('button', { name: /老王/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: '老王' })).toBeVisible()

  await nav(page).getByRole('button', { name: '名單' }).click()
  await expect(page.getByRole('button', { name: '查看 新來的 的個人數據' })).toHaveCount(0)
  await page.getByRole('button', { name: '查看 阿華 的個人數據' }).click()
  await expect(page.getByRole('heading', { level: 1, name: '阿華' })).toBeVisible()
  await expect(nav(page).getByRole('button', { name: '名單' })).toHaveAttribute('aria-current', 'page')
  await page.getByRole('button', { name: '返回' }).click()
  await expect(page.getByRole('heading', { name: '牌咖與場地' })).toBeVisible()
})
