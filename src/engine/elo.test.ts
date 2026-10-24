import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { eloDelta, expectedScore, rankTitle } from './elo.ts'

describe('рейтинг', () => {
  it('равные соперники делят ожидание пополам', () => {
    assert.equal(expectedScore(1200, 1200), 0.5)
  })

  it('новичок получает больше очков за победу над равным', () => {
    const newbie = eloDelta(1200, 1200, 1, 0)
    const regular = eloDelta(1200, 1200, 1, 20)
    assert.equal(newbie, 20)
    assert.equal(regular, 12)
  })

  it('звание растёт вместе с рейтингом', () => {
    assert.equal(rankTitle(1000), 'Новичок')
    assert.equal(rankTitle(1200), 'Игрок')
    assert.equal(rankTitle(1400), 'Знаток')
    assert.equal(rankTitle(1600), 'Мастер')
    assert.equal(rankTitle(1800), 'Гроссмейстер')
  })
})
